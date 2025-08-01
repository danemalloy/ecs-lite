import { Entity, Component, ComponentClass, ComponentId, Archetype, QueryCache } from "./types";

export class ComponentManager {
	private componentIdCounter: ComponentId = 0;
	private componentClassToId = new Map<ComponentClass, ComponentId>();
	private componentIdToClass = new Map<ComponentId, ComponentClass>();

	private archetypes = new Map<string, Archetype>();
	private entityToArchetype = new Map<Entity, Archetype>();
	private entityToIndex = new Map<Entity, number>();

	private queryCache = new Map<string, QueryCache>();

	private archetypesByComponentId = new Map<ComponentId, Set<Archetype>>();
	private componentPoolsById = new Map<ComponentId, Component[]>();
	private recycledComponents = new Map<ComponentId, Component[]>();
	private batchInvalidation = false;
	private pendingCacheInvalidation = false;

	/**
	 * Gets or creates a component ID for a component class
	 */
	private getComponentId<T extends Component>(componentClass: ComponentClass<T>): ComponentId {
		let id = this.componentClassToId.get(componentClass);
		if (id === undefined) {
			id = this.componentIdCounter++;
			this.componentClassToId.set(componentClass, id);
			this.componentIdToClass.set(id, componentClass);
			this.archetypesByComponentId.set(id, new Set());
			this.componentPoolsById.set(id, []);
			this.recycledComponents.set(id, []);
		}
		return id;
	}

	/**
	 * Creates an archetype signature string for hashing
	 */
	private createSignature(componentIds: ComponentId[]): string {
		return componentIds.join(",");
	}

	/**
	 * Gets or creates an archetype for the given component signature
	 */
	private getOrCreateArchetype(componentIds: ComponentId[]): Archetype {
		const signature = this.createSignature(componentIds);
		let archetype = this.archetypes.get(signature);

		if (!archetype) {
			archetype = {
				signature: [...componentIds],
				entities: [],
				componentArrays: new Map(),
			};

			for (const componentId of componentIds) {
				const componentArray: Component[] = [];
				archetype.componentArrays.set(componentId, componentArray);

				this.archetypesByComponentId.get(componentId)!.add(archetype);
			}

			this.archetypes.set(signature, archetype);
			this.scheduleQueryCacheInvalidation();
		}

		return archetype;
	}

	/**
	 * Optimized entity moving with batch operations
	 */
	private moveEntity(entity: Entity, fromArchetype: Archetype, toArchetype: Archetype): void {
		const entityIndex = this.entityToIndex.get(entity);
		if (entityIndex === undefined) return;

		const newIndex = toArchetype.entities.size();

		for (const componentId of fromArchetype.signature) {
			const targetArray = toArchetype.componentArrays.get(componentId);
			if (targetArray) {
				const sourceArray = fromArchetype.componentArrays.get(componentId)!;
				targetArray.push(sourceArray[entityIndex]);
			}
		}

		this.swapRemoveFromArchetype(entity, fromArchetype, entityIndex);

		toArchetype.entities.push(entity);
		this.entityToArchetype.set(entity, toArchetype);
		this.entityToIndex.set(entity, newIndex);
	}

	/**
	 * Optimized swap-remove operation
	 */
	private swapRemoveFromArchetype(entity: Entity, archetype: Archetype, entityIndex: number): void {
		const lastIndex = archetype.entities.size() - 1;

		if (entityIndex !== lastIndex) {
			const lastEntity = archetype.entities[lastIndex];

			archetype.entities[entityIndex] = lastEntity;
			this.entityToIndex.set(lastEntity, entityIndex);

			for (const [componentId, componentArray] of archetype.componentArrays) {
				componentArray[entityIndex] = componentArray[lastIndex];
			}
		}

		archetype.entities.pop();
		for (const [, componentArray] of archetype.componentArrays) {
			const removedComponent = componentArray.pop();
			if (removedComponent) {
				const componentId = this.getComponentIdFromArray(componentArray, archetype);
				if (componentId !== undefined) {
					this.recycleComponent(componentId, removedComponent);
				}
			}
		}
	}

	/**
	 * Helper to find component ID from array (optimization helper)
	 */
	private getComponentIdFromArray(componentArray: Component[], archetype: Archetype): ComponentId | undefined {
		for (const [componentId, array] of archetype.componentArrays) {
			if (array === componentArray) {
				return componentId;
			}
		}
		return undefined;
	}

	/**
	 * Component recycling for memory efficiency
	 */
	private recycleComponent(componentId: ComponentId, component: Component): void {
		const recycled = this.recycledComponents.get(componentId);
		if (recycled && recycled.size() < 1000) {
			recycled.push(component);
		}
	}

	/**
	 * Get recycled component or create new one
	 */
	private getOrCreateComponent<T extends Component>(componentClass: ComponentClass<T>, ...args: never[]): T {
		const componentId = this.getComponentId(componentClass);
		const recycled = this.recycledComponents.get(componentId);

		if (recycled && recycled.size() > 0) {
			const component = recycled.pop() as T;
			return component;
		}

		return new componentClass(...args);
	}

	/**
	 * Batch operations support
	 */
	startBatch(): void {
		this.batchInvalidation = true;
	}

	endBatch(): void {
		this.batchInvalidation = false;
		if (this.pendingCacheInvalidation) {
			this.invalidateQueryCaches();
			this.pendingCacheInvalidation = false;
		}
	}

	/**
	 * Optimized cache invalidation
	 */
	private scheduleQueryCacheInvalidation(): void {
		if (this.batchInvalidation) {
			this.pendingCacheInvalidation = true;
		} else {
			this.invalidateQueryCaches();
		}
	}

	/**
	 * Fast component addition with minimal archetype transitions
	 */
	addComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>, component: T): void {
		const componentId = this.getComponentId(componentClass);
		const currentArchetype = this.entityToArchetype.get(entity);

		if (currentArchetype) {
			if (currentArchetype.componentArrays.has(componentId)) {
				const entityIndex = this.entityToIndex.get(entity)!;
				const componentArray = currentArchetype.componentArrays.get(componentId)!;
				componentArray[entityIndex] = component;
				return;
			}

			const newSignature = [...currentArchetype.signature, componentId].sort((a, b) => a < b);
			const newArchetype = this.getOrCreateArchetype(newSignature);

			this.moveEntity(entity, currentArchetype, newArchetype);
			const newIndex = newArchetype.entities.size() - 1;
			const componentArray = newArchetype.componentArrays.get(componentId)!;
			componentArray[newIndex] = component;
		} else {
			const newArchetype = this.getOrCreateArchetype([componentId]);
			const newIndex = newArchetype.entities.size();

			newArchetype.entities.push(entity);
			const componentArray = newArchetype.componentArrays.get(componentId)!;
			componentArray.push(component);

			this.entityToArchetype.set(entity, newArchetype);
			this.entityToIndex.set(entity, newIndex);
		}

		this.scheduleQueryCacheInvalidation();
	}

	/**
	 * Optimized component retrieval
	 */
	getComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): T | undefined {
		const archetype = this.entityToArchetype.get(entity);
		if (!archetype) return undefined;

		const componentId = this.getComponentId(componentClass);
		const componentArray = archetype.componentArrays.get(componentId);
		if (!componentArray) return undefined;

		const entityIndex = this.entityToIndex.get(entity);
		if (entityIndex === undefined) return undefined;

		return componentArray[entityIndex] as T;
	}

	/**
	 * Fast component existence check
	 */
	hasComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): boolean {
		const archetype = this.entityToArchetype.get(entity);
		if (!archetype) return false;

		const componentId = this.getComponentId(componentClass);
		return archetype.componentArrays.has(componentId);
	}

	/**
	 * Optimized component removal
	 */
	removeComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): boolean {
		const currentArchetype = this.entityToArchetype.get(entity);
		if (!currentArchetype) return false;

		const componentId = this.getComponentId(componentClass);
		if (!currentArchetype.componentArrays.has(componentId)) return false;

		const newSignature = currentArchetype.signature.filter((id) => id !== componentId);

		if (newSignature.size() === 0) {
			this.removeAllComponents(entity);
		} else {
			const newArchetype = this.getOrCreateArchetype(newSignature);
			this.moveEntity(entity, currentArchetype, newArchetype);
		}

		this.scheduleQueryCacheInvalidation();
		return true;
	}

	/**
	 * Optimized bulk component removal
	 */
	removeAllComponents(entity: Entity): void {
		const archetype = this.entityToArchetype.get(entity);
		if (!archetype) return;

		const entityIndex = this.entityToIndex.get(entity);
		if (entityIndex === undefined) return;

		this.swapRemoveFromArchetype(entity, archetype, entityIndex);

		this.entityToArchetype.delete(entity);
		this.entityToIndex.delete(entity);
		this.scheduleQueryCacheInvalidation();
	}

	/**
	 * Highly optimized single component query
	 */
	getEntitiesWithComponent<T extends Component>(componentClass: ComponentClass<T>): Entity[] {
		const componentId = this.getComponentId(componentClass);
		const archetypes = this.archetypesByComponentId.get(componentId);

		if (!archetypes || archetypes.size() === 0) {
			return [];
		}

		const entities: Entity[] = [];
		let totalSize = 0;

		for (const archetype of archetypes) {
			totalSize += archetype.entities.size();
		}

		let index = 0;

		for (const archetype of archetypes) {
			for (let i = 0; i < archetype.entities.size(); i++) {
				entities[index++] = archetype.entities[i];
			}
		}

		return entities;
	}

	/**
	 * Optimized multi-component query with better caching
	 */
	getEntitiesWithComponents(componentClasses: ComponentClass[]): Entity[] {
		if (componentClasses.size() === 0) return [];

		const componentIds = componentClasses.map((cls) => this.getComponentId(cls)).sort((a, b) => a < b);
		const cacheKey = this.createSignature(componentIds);

		let cache = this.queryCache.get(cacheKey);
		if (!cache) {
			cache = {
				signature: componentIds,
				entities: [],
				archetypes: new Set(),
				needsUpdate: true,
			};
			this.queryCache.set(cacheKey, cache);
		}

		if (cache.needsUpdate) {
			this.updateQueryCacheOptimized(cache);
		}

		return [...cache.entities];
	}

	/**
	 * Optimized query cache update using archetype indexing
	 */
	private updateQueryCacheOptimized(cache: QueryCache): void {
		cache.entities.clear();
		cache.archetypes.clear();

		const firstComponentId = cache.signature[0];
		const candidateArchetypes = this.archetypesByComponentId.get(firstComponentId);

		if (!candidateArchetypes) {
			cache.needsUpdate = false;
			return;
		}

		for (const archetype of candidateArchetypes) {
			const hasAllComponents = cache.signature.every((componentId) => archetype.componentArrays.has(componentId));

			if (hasAllComponents) {
				cache.archetypes.add(archetype);
				for (let i = 0; i < archetype.entities.size(); i++) {
					cache.entities.push(archetype.entities[i]);
				}
			}
		}

		cache.needsUpdate = false;
	}

	/**
	 * Highly optimized batch component retrieval
	 */
	getComponentsForEntities<T extends Component>(
		entities: Entity[],
		componentClass: ComponentClass<T>,
	): Map<Entity, T> {
		const result = new Map<Entity, T>();
		const componentId = this.getComponentId(componentClass);

		const archetypeGroups = new Map<Archetype, Entity[]>();

		for (const entity of entities) {
			const archetype = this.entityToArchetype.get(entity);
			if (archetype && archetype.componentArrays.has(componentId)) {
				let group = archetypeGroups.get(archetype);
				if (!group) {
					group = [];
					archetypeGroups.set(archetype, group);
				}
				group.push(entity);
			}
		}

		for (const [archetype, archetypeEntities] of archetypeGroups) {
			const componentArray = archetype.componentArrays.get(componentId)!;

			for (const entity of archetypeEntities) {
				const entityIndex = this.entityToIndex.get(entity);
				if (entityIndex !== undefined) {
					result.set(entity, componentArray[entityIndex] as T);
				}
			}
		}

		return result;
	}

	/**
	 * Optimized cache invalidation
	 */
	private invalidateQueryCaches(): void {
		for (const [, cache] of this.queryCache) {
			cache.needsUpdate = true;
		}
	}

	/**
	 * Clear query cache (for memory management)
	 */
	clearQueryCache(): void {
		this.queryCache.clear();
	}

	/**
	 * Get performance statistics
	 */
	getStats(): {
		archetypes: number;
		entities: number;
		cachedQueries: number;
		componentTypes: number;
	} {
		let totalEntities = 0;
		for (const [, archetype] of this.archetypes) {
			totalEntities += archetype.entities.size();
		}

		return {
			archetypes: this.archetypes.size(),
			entities: totalEntities,
			cachedQueries: this.queryCache.size(),
			componentTypes: this.componentIdCounter,
		};
	}
}
