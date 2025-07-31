import { Entity, Component, ComponentClass, ComponentQuest } from "./types";
import { EntityManager } from "./entity";
import { ComponentManager } from "./component";

export class World {
	private entityManager: EntityManager = new EntityManager();
	private componentManager: ComponentManager = new ComponentManager();

	/**
	 * Creates a new entity
	 * @returns A new entity ID
	 */
	createEntity(): Entity {
		return this.entityManager.createEntity();
	}

	/**
	 * Destroys an entity and removes all its components
	 * @param entity The entity to destroy
	 */
	destroyEntity(entity: Entity): void {
		this.componentManager.removeAllComponents(entity);
		this.entityManager.destroyEntity(entity);
	}

	/**
	 * Gets the total number of active entities
	 * @returns The number of active entities
	 */
	getEntityCount(): number {
		return this.entityManager.getEntityCount();
	}

	/**
	 * Adds a component to an entity
	 * @param entity The entity to add the component to
	 * @param component The component instance to add
	 * @returns The world instance for method chaining
	 */
	addComponent<T extends Component>(entity: Entity, component: T): World {
		this.componentManager.addComponent(entity, component);
		return this;
	}

	/**
	 * Gets a component from an entity
	 * @param entity The entity to get the component from
	 * @param componentClass The class of the component to retrieve
	 * @returns The component instance, or undefined if not found
	 */
	getComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): T | undefined {
		return this.componentManager.getComponent(entity, componentClass);
	}

	/**
	 * Checks if an entity has a specific component
	 * @param entity The entity to check
	 * @param componentClass The component class to check for
	 * @returns True if the entity has the component, false otherwise
	 */
	hasComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): boolean {
		return this.componentManager.hasComponent(entity, componentClass);
	}

	/**
	 * Removes a component from an entity
	 * @param entity The entity to remove the component from
	 * @param componentClass The class of the component to remove
	 * @returns The world instance for method chaining
	 */
	removeComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): World {
		this.componentManager.removeComponent(entity, componentClass);
		return this;
	}

	/**
	 * Gets all entities that have a specific component
	 * @param componentClass The component class to search for
	 * @returns An array of entities that have the component
	 */
	getEntitiesWithComponent<T extends Component>(componentClass: ComponentClass<T>): Entity[] {
		return this.componentManager.getEntitiesWithComponent(componentClass);
	}

	/**
	 * Gets all entities that have all of the specified components
	 * @param componentClasses Array of component classes to match (ComponentQuest)
	 * @returns An array of entities that have all the specified components
	 */
	getEntitiesWithComponents(componentClasses: ComponentQuest): Entity[] {
		return this.componentManager.getEntitiesWithComponents(componentClasses);
	}
}
