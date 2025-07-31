import { Entity } from "./types";

export class EntityManager {
	private entities = new Set<Entity>();
	private nextId: Entity = 1;
	private recycledIds: Entity[] = [];

	/**
	 * Creates a new entity with a unique ID
	 * @returns A new entity ID
	 */
	createEntity(): Entity {
		let id: Entity;

		if (this.recycledIds.size() > 0) {
			id = this.recycledIds.pop()!;
		} else {
			id = this.nextId++;
		}

		this.entities.add(id);
		return id;
	}

	/**
	 * Destroys an entity and marks its ID for recycling
	 * @param id The entity ID to destroy
	 */
	destroyEntity(id: Entity): void {
		if (this.entities.has(id)) {
			this.entities.delete(id);
			this.recycledIds.push(id);
		}
	}

	/**
	 * Checks if an entity exists.
	 * @param id The entity ID to check
	 * @returns True if the entity exists, false otherwise
	 */
	entityExist(id: Entity): boolean {
		return this.entities.has(id);
	}

	/**
	 * Gets all active entities.
	 * @returns A readonly set of all active entity IDs
	 */
	getAllEntities(): ReadonlySet<Entity> {
		return this.entities;
	}

	/**
	 * Clears all entities and resets the manager
	 */
	clear(): void {
		this.entities.clear();
		this.recycledIds.clear();
		this.nextId = 1;
	}
}
