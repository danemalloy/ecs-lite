import { World } from "./world";

export interface System {
	/**
	 * Called when the system is added to the world
	 * Use this for initialization logic
	 * @param world The world this system belongs to
	 */
	onAdded?(world: World): void;

	/**
	 * Called when the system is removed from the world
	 * Use this for cleanup logic
	 * @param world The world this system belonged to
	 */
	onRemoved?(world: World): void;

	/**
	 * Called every frame to update the system
	 * This is where the main system logic should go
	 * @param world The world this system belongs to
	 * @param deltaTime Time elapsed since the last update (in seconds)
	 */
	update?(world: World, deltaTime: number): void;

	/**
	 * Called at a fixed interval for physics and other time-critical updates
	 * @param world The world this system belongs to
	 * @param fixedDeltaTime Fixed time step (usually 1/60 seconds)
	 */
	fixedUpdate?(world: World, fixedDeltaTime: number): void;
}

export class SystemManager {
	private systems: System[] = [];
	private systemsMap = new Map<System, boolean>();

	/**
	 * Adds a system to the manager
	 * @param system The system to add
	 * @param world The world to pass to the system's onAdded method
	 */
	addSystem(system: System, world: World): void {
		if (this.systemsMap.has(system)) {
			warn(`[ecs-lite] System ${tostring(system)} is already added to the world`);
			return;
		}

		this.systems.push(system);
		this.systemsMap.set(system, true);

		if (system.onAdded) {
			system.onAdded(world);
		}
	}

	/**
	 * Removes a system from the manager
	 * @param system The system to remove
	 * @param world The world to pass to the system's onRemoved method
	 * @returns True if the system was removed, false if it wasn't found
	 */
	removeSystem(system: System, world: World): boolean {
		if (!this.systemsMap.has(system)) {
			return false;
		}

		const index = this.systems.indexOf(system);
		if (index !== -1) {
			this.systems.unorderedRemove(index);
		}

		this.systemsMap.delete(system);

		if (system.onRemoved) {
			system.onRemoved(world);
		}

		return true;
	}

	/**
	 * Checks if a system is registered
	 * @param system The system to check
	 * @returns True if the system is registered, false otherwise
	 */
	hasSystem(system: System): boolean {
		return this.systemsMap.has(system);
	}

	/**
	 * Gets all registered systems
	 * @returns A copy of the systems array
	 */
	getSystems(): System[] {
		return [...this.systems];
	}

	/**
	 * Updates all systems that have an update method
	 * @param world The world to pass to the systems
	 * @param deltaTime Time elapsed since the last update
	 */
	updateSystems(world: World, deltaTime: number): void {
		for (const system of this.systems) {
			if (system.update) {
				system.update(world, deltaTime);
			}
		}
	}

	/**
	 * Fixed updates all systems that have a fixedUpdate method
	 * @param world The world to pass to the systems
	 * @param fixedDeltaTime Fixed time step
	 */
	fixedUpdateSystems(world: World, fixedDeltaTime: number): void {
		for (const system of this.systems) {
			if (system.fixedUpdate) {
				system.fixedUpdate(world, fixedDeltaTime);
			}
		}
	}

	/**
	 * Removes all systems from the manager
	 * @param world The world to pass to each system's onRemoved method
	 */
	clear(world: World): void {
		for (const system of this.systems) {
			if (system.onRemoved) {
				system.onRemoved(world);
			}
		}

		this.systems.clear();
		this.systemsMap.clear();
	}
}
