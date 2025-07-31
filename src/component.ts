import { Entity, Component, ComponentClass, ComponentId, Archetype, QueryCache } from "./types";

export class ComponentManager {
	private componentIdCounter: ComponentId = 0;
	private componentClassToId = new Map<ComponentClass, ComponentId>();
	private componentIdToClass = new Map<ComponentId, ComponentClass>();

	private archetypes = new Map<string, Archetype>();
	private entityToArchetype = new Map<Entity, Archetype>();
	private entityToIndex = new Map<Entity, number>();

	private queryCache = new Map<string, QueryCache>();

	/**
	 * Gets or creates a component ID for a component class
	 * @param componentClass The component class
	 * @returns The component ID
	 */
	private getComponentId<T extends Component>(componentClass: ComponentClass<T>): ComponentId {
		let id = this.componentClassToId.get(componentClass);
		if (id === undefined) {
			id = this.componentIdCounter++;
			this.componentClassToId.set(componentClass, id);
			this.componentIdToClass.set(id, componentClass);
		}
		return id;
	}

	/**
	 * Creates an archetype signature string for hashing
	 * @param componentIds Sorted array of component IDs
	 * @returns Signature string
	 */
	private createSignature(componentIds: ComponentId[]): string {
		return componentIds.join(",");
	}

	/**
	 * Gets or creates an archetype for the given component signature
	 * @param componentIds Sorted array of component IDs
	 * @returns The archetype
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
				archetype.componentArrays.set(componentId, []);
			}

			this.archetypes.set(signature, archetype);

			this.invalidateQueryCaches();
		}

		return archetype;
	}

	/**
	 * Moves an entity from one archetype to another
	 * @param entity The entity to move
	 * @param fromArchetype The source archetype
	 * @param toArchetype The destination archetype
	 */
	private moveEntity(entity: Entity, fromArchetype: Archetype, toArchetype: Archetype): void {
		const entityIndex = this.entityToIndex.get(entity);
		if (entityIndex === undefined) return;

		for (const componentId of fromArchetype.signature) {
			if (toArchetype.componentArrays.has(componentId)) {
				const sourceArray = fromArchetype.componentArrays.get(componentId)!;
				const targetArray = toArchetype.componentArrays.get(componentId)!;
				targetArray.push(sourceArray[entityIndex]);
			}
		}

		const lastIndex = fromArchetype.entities.size() - 1;
		if (entityIndex !== lastIndex) {
			const lastEntity = fromArchetype.entities[lastIndex];
			fromArchetype.entities[entityIndex] = lastEntity;
			this.entityToIndex.set(lastEntity, entityIndex);

			for (const [componentId, componentArray] of fromArchetype.componentArrays) {
				componentArray[entityIndex] = componentArray[lastIndex];
			}
		}

		fromArchetype.entities.pop();
		for (const [, componentArray] of fromArchetype.componentArrays) {
			componentArray.pop();
		}

		const newIndex = toArchetype.entities.size();
		toArchetype.entities.push(entity);
		this.entityToArchetype.set(entity, toArchetype);
		this.entityToIndex.set(entity, newIndex);
	}

	/**
	 * Adds a component to an entity
	 * @param entity The entity to add the component to
	 * @param component The component instance to add
	 */
	addComponent<T extends Component>(entity: Entity, component: T): void {
		const componentId = this.getComponentId(component.constructor as ComponentClass<T>);
		const currentArchetype = this.entityToArchetype.get(entity);

		if (currentArchetype) {
			if (currentArchetype.componentArrays.has(componentId)) {
				const entityIndex = this.entityToIndex.get(entity)!;
				const componentArray = currentArchetype.componentArrays.get(componentId)!;
				componentArray[entityIndex] = component;
				return;
			}

			const newSignature = [...currentArchetype.signature, componentId].sort((a, b) => a - b);
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

		this.invalidateQueryCaches();
	}

	/**
	 * Gets a component from an entity
	 * @param entity The entity to get the component from
	 * @param componentClass The class of the component to retrieve
	 * @returns The component instance, or undefined if not found
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
	 * Checks if an entity has a specific component
	 * @param entity The entity to check
	 * @param componentClass The component class to check for
	 * @returns True if the entity has the component, false otherwise
	 */
	hasComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): boolean {
		const archetype = this.entityToArchetype.get(entity);
		if (!archetype) return false;

		const componentId = this.getComponentId(componentClass);
		return archetype.componentArrays.has(componentId);
	}

	/**
	 * Removes a component from an entity
	 * @param entity The entity to remove the component from
	 * @param componentClass The class of the component to remove
	 * @returns True if the component was removed, false if it didn't exist
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

		this.invalidateQueryCaches();
		return true;
	}

	/**
	 * Removes all components from an entity
	 * @param entity The entity to remove all components from
	 */
	removeAllComponents(entity: Entity): void {
		const archetype = this.entityToArchetype.get(entity);
		if (!archetype) return;

		const entityIndex = this.entityToIndex.get(entity);
		if (entityIndex === undefined) return;

		const lastIndex = archetype.entities.size() - 1;
		if (entityIndex !== lastIndex) {
			const lastEntity = archetype.entities[lastIndex];
			archetype.entities[entityIndex] = lastEntity;
			this.entityToIndex.set(lastEntity, entityIndex);

			for (const [, componentArray] of archetype.componentArrays) {
				componentArray[entityIndex] = componentArray[lastIndex];
			}
		}

		archetype.entities.pop();
		for (const [, componentArray] of archetype.componentArrays) {
			componentArray.pop();
		}

		this.entityToArchetype.delete(entity);
		this.entityToIndex.delete(entity);
		this.invalidateQueryCaches();
	}

	/**
	 * Gets all entities that have a specific component
	 * @param componentClass The component class to search for
	 * @returns An array of entities that have the component
	 */
	getEntitiesWithComponent<T extends Component>(componentClass: ComponentClass<T>): Entity[] {
		const componentId = this.getComponentId(componentClass);
		const entities: Entity[] = [];

		for (const archetype of this.archetypes.values()) {
			if (archetype.componentArrays.has(componentId)) {
				entities.push(...archetype.entities);
			}
		}

		return entities;
	}

	/**
	 * Gets all entities that have all of the specified components (with caching)
	 * @param componentClasses Array of component classes to match
	 * @returns An array of entities that have all the specified components
	 */
	getEntitiesWithComponents(componentClasses: readonly ComponentClass[]): Entity[] {
		if (componentClasses.size() === 0) return [];

		const componentIds = componentClasses.map((cls) => this.getComponentId(cls)).sort((a, b) => a - b);
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
			this.updateQueryCache(cache);
		}

		return [...cache.entities];
	}

	/**
	 * Updates a query cache
	 * @param cache The query cache to update
	 */
	private updateQueryCache(cache: QueryCache): void {
		cache.entities.clear();
		cache.archetypes.clear();

		for (const archetype of this.archetypes.values()) {
			const hasAllComponents = cache.signature.every((componentId) => archetype.componentArrays.has(componentId));

			if (hasAllComponents) {
				cache.archetypes.add(archetype);
				cache.entities.push(...archetype.entities);
			}
		}

		cache.needsUpdate = false;
	}

	/**
	 * Invalidates all query caches
	 */
	private invalidateQueryCaches(): void {
		for (const cache of this.queryCache.values()) {
			cache.needsUpdate = true;
		}
	}

	/**
	 * Gets component arrays for efficient iteration
	 * @param entities Array of entities to process
	 * @param componentClass The component class to retrieve
	 * @returns Map from entity to component
	 */
	getComponentsForEntities<T extends Component>(
		entities: readonly Entity[],
		componentClass: ComponentClass<T>,
	): Map<Entity, T> {
		const result = new Map<Entity, T>();
		const componentId = this.getComponentId(componentClass);

		const archetypeGroups = new Map<Archetype, Entity[]>();

		for (const entity of entities) {
			const archetype = this.entityToArchetype.get(entity);
			if (archetype && archetype.componentArrays.has(componentId)) {
				if (!archetypeGroups.has(archetype)) {
					archetypeGroups.set(archetype, []);
				}
				archetypeGroups.get(archetype)!.push(entity);
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
}
