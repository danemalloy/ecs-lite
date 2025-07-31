import { Entity, Component, ComponentClass, ComponentQuest } from "./types";

export class ComponentManager {
	private components = new Map<ComponentClass, Map<Entity, Component>>();

	/**
	 * Adds a component to an entity
	 * @param entity The entity to add the component to
	 * @param component The component instance to add
	 */
	addComponent<T extends Component>(entity: Entity, component: T): void {
		const componentClass = component.constructor as ComponentClass<T>;
		if (!this.components.has(componentClass)) {
			this.components.set(componentClass, new Map());
		}

		const componentMap = this.components.get(componentClass)!;
		componentMap.set(entity, component);
	}

	/**
	 * Gets a component from an entity
	 * @param entity The entity to get the component from
	 * @param componentClass The class of the component to retrieve
	 * @returns The component instance, or undefined if not found
	 */
	getComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): T | undefined {
		const componentMap = this.components.get(componentClass);
		if (!componentMap) {
			return undefined;
		}

		return componentMap.get(entity) as T | undefined;
	}

	/**
	 * Checks if an entity has a specific component.
	 * @param entity The entity to check
	 * @param componentClass The component class to check for
	 * @returns True if the entity has the component, false otherwise
	 */
	hasComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): boolean {
		const componentMap = this.components.get(componentClass);
		if (!componentMap) {
			return false;
		}

		return componentMap.has(entity);
	}

	/**
	 * Removes a component from an entity
	 * @param entity The entity to remove the component from
	 * @param componentClass The class of the component to remove
	 * @returns True if the component was removed, false if it didn't exist
	 */
	removeComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): boolean {
		const componentMap = this.components.get(componentClass);
		if (!componentMap) {
			return false;
		}

		return componentMap.delete(entity);
	}

	/**
	 * Removes all components from an entity
	 * @param entity The entity to remove all components from
	 */
	removeAllComponents(entity: Entity): void {
		for (const [, componentMap] of this.components) {
			componentMap.delete(entity);
		}
	}

	/**
	 * Gets all entities that have a specific component
	 * @param componentClass The component class to search for
	 * @returns An array of entities that have the component
	 */
	getEntitiesWithComponent<T extends Component>(componentClass: ComponentClass<T>): Entity[] {
		const componentMap = this.components.get(componentClass);
		if (!componentMap) {
			return [];
		}

		const entities: Entity[] = [];
		for (const [entity] of componentMap) {
			entities.push(entity);
		}

		return entities;
	}

	/**
	 * Gets all entities that have all of the specified components
	 * @param componentClasses Array of component classes to match (ComponentQuest)
	 * @returns An array of entities that have all the specified components
	 */
	getEntitiesWithComponents(componentClasses: ComponentQuest): Entity[] {
		if (componentClasses.size() === 0) {
			return [];
		}

		let entities = this.getEntitiesWithComponent(componentClasses[0]);
		for (let i = 1; i < componentClasses.size(); i++) {
			const componentClass = componentClasses[i];
			entities = entities.filter((entity) => this.hasComponent(entity, componentClass));
		}

		return entities;
	}
}
