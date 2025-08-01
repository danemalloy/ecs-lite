import { Entity, Component, ComponentClass } from "./types";
import { EntityManager } from "./entity";
import { ComponentManager } from "./component";
import { System, SystemManager } from "./system";

export class World {
	private entityManager: EntityManager = new EntityManager();
	private componentManager: ComponentManager = new ComponentManager();
	private systemManager: SystemManager = new SystemManager();

	/**
	 * Creates a new entity
	 */
	createEntity(): Entity {
		return this.entityManager.createEntity();
	}

	/**
	 * Destroys an entity and removes all its components
	 */
	destroyEntity(entity: Entity): void {
		this.componentManager.removeAllComponents(entity);
		this.entityManager.destroyEntity(entity);
	}

	/**
	 * Gets the total number of active entities
	 */
	getEntityCount(): number {
		return this.entityManager.getEntityCount();
	}

	/**
	 * Batch operations for better performance
	 */
	batch(operations: () => void): void {
		this.componentManager.startBatch();
		try {
			operations();
		} finally {
			this.componentManager.endBatch();
		}
	}

	/**
	 * Adds a component to an entity
	 */
	addComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>, component: T): this {
		this.componentManager.addComponent(entity, componentClass, component);
		return this;
	}

	/**
	 * Adds multiple components to an entity efficiently
	 */
	addComponents(entity: Entity, components: Array<{ class: ComponentClass; component: Component }>): this {
		this.batch(() => {
			for (const { class: componentClass, component } of components) {
				this.componentManager.addComponent(entity, componentClass, component);
			}
		});
		return this;
	}

	/**
	 * Gets a component from an entity
	 */
	getComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): T | undefined {
		return this.componentManager.getComponent(entity, componentClass);
	}

	/**
	 * Checks if an entity has a specific component
	 */
	hasComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): boolean {
		return this.componentManager.hasComponent(entity, componentClass);
	}

	/**
	 * Checks if an entity has all specified components
	 */
	hasComponents(entity: Entity, componentClasses: ComponentClass[]): boolean {
		for (const componentClass of componentClasses) {
			if (!this.componentManager.hasComponent(entity, componentClass)) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Removes a component from an entity
	 */
	removeComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): this {
		this.componentManager.removeComponent(entity, componentClass);
		return this;
	}

	/**
	 * Removes multiple components from an entity efficiently
	 */
	removeComponents(entity: Entity, componentClasses: ComponentClass[]): this {
		this.batch(() => {
			for (const componentClass of componentClasses) {
				this.componentManager.removeComponent(entity, componentClass);
			}
		});
		return this;
	}

	/**
	 * Gets all entities that have a specific component
	 */
	getEntitiesWithComponent<T extends Component>(componentClass: ComponentClass<T>): Entity[] {
		return this.componentManager.getEntitiesWithComponent(componentClass);
	}

	/**
	 * Gets all entities that have all of the specified components
	 */
	getEntitiesWithComponents(componentClasses: ComponentClass[]): Entity[] {
		return this.componentManager.getEntitiesWithComponents(componentClasses);
	}

	/**
	 * Gets components for multiple entities efficiently
	 */
	getComponentsForEntities<T extends Component>(
		entities: Entity[],
		componentClass: ComponentClass<T>,
	): Map<Entity, T> {
		return this.componentManager.getComponentsForEntities(entities, componentClass);
	}

	/**
	 * Advanced query builder for complex queries
	 */
	query(...componentClasses: ComponentClass[]): QueryBuilder {
		return new QueryBuilder(this, componentClasses);
	}

	/**
	 * Adds a system to the world
	 */
	addSystem(system: System): this {
		this.systemManager.addSystem(system, this);
		return this;
	}

	/**
	 * Removes a system from the world
	 */
	removeSystem(system: System): this {
		this.systemManager.removeSystem(system, this);
		return this;
	}

	/**
	 * Checks if a system is registered in the world
	 */
	hasSystem(system: System): boolean {
		return this.systemManager.hasSystem(system);
	}

	/**
	 * Gets all registered systems
	 */
	getSystems(): readonly System[] {
		return this.systemManager.getSystems();
	}

	/**
	 * Updates all systems in the world
	 */
	update(deltaTime: number): void {
		this.systemManager.updateSystems(this, deltaTime);
	}

	/**
	 * Fixed updates all systems in the world
	 */
	fixedUpdate(fixedDeltaTime: number): void {
		this.systemManager.fixedUpdateSystems(this, fixedDeltaTime);
	}

	/**
	 * Clears the world by removing all entities, components, and systems
	 */
	clear(): void {
		this.systemManager.clear(this);
		this.componentManager = new ComponentManager();
		this.entityManager.clear();
	}

	/**
	 * Get performance statistics
	 */
	getStats(): {
		entities: number;
		archetypes: number;
		cachedQueries: number;
		componentTypes: number;
		systems: number;
	} {
		const componentStats = this.componentManager.getStats();
		return {
			...componentStats,
			systems: this.systemManager.getSystems().size(),
		};
	}

	/**
	 * Clear query cache for memory management
	 */
	clearQueryCache(): void {
		this.componentManager.clearQueryCache();
	}
}

/**
 * Advanced query builder for fluent API
 */
class QueryBuilder {
	private componentClasses: ComponentClass[];

	constructor(
		private world: World,
		componentClasses: ComponentClass[],
	) {
		this.componentClasses = componentClasses;
	}

	/**
	 * Execute the query and return entities
	 */
	entities(): Entity[] {
		return this.world.getEntitiesWithComponents(this.componentClasses);
	}

	/**
	 * Execute query and iterate with components
	 */
	forEach(callback: (entity: Entity, components: Component[]) => void): void {
		const entities = this.entities();

		for (const entity of entities) {
			const components: Component[] = [];
			for (const componentClass of this.componentClasses) {
				const component = this.world.getComponent(entity, componentClass);
				if (component) {
					components.push(component);
				}
			}

			if (components.size() === this.componentClasses.size()) {
				callback(entity, components);
			}
		}
	}

	/**
	 * Execute query and iterate with typed components (up to 4 components)
	 */
	forEachTyped<
		T1 extends Component,
		T2 extends Component = never,
		T3 extends Component = never,
		T4 extends Component = never,
	>(callback: (entity: Entity, c1: T1, c2?: T2, c3?: T3, c4?: T4) => void): void {
		const entities = this.entities();

		for (const entity of entities) {
			const c1 = this.world.getComponent(entity, this.componentClasses[0] as ComponentClass<T1>);
			const c2 = this.componentClasses[1]
				? this.world.getComponent(entity, this.componentClasses[1] as ComponentClass<T2>)
				: undefined;
			const c3 = this.componentClasses[2]
				? this.world.getComponent(entity, this.componentClasses[2] as ComponentClass<T3>)
				: undefined;
			const c4 = this.componentClasses[3]
				? this.world.getComponent(entity, this.componentClasses[3] as ComponentClass<T4>)
				: undefined;

			if (c1) {
				callback(entity, c1, c2, c3, c4);
			}
		}
	}

	/**
	 * Count entities matching the query
	 */
	count(): number {
		return this.entities().size();
	}

	/**
	 * Check if any entities match the query
	 */
	any(): boolean {
		return this.count() > 0;
	}

	/**
	 * Get the first entity matching the query
	 */
	first(): Entity | undefined {
		const entities = this.entities();
		return entities.size() > 0 ? entities[0] : undefined;
	}
}
