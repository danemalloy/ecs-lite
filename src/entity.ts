import { Entity } from "./types";

export class EntityManager {
	private entities = new Set<Entity>();
	private nextId: Entity = 1;
	private recycledIds: Entity[] = [];

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

	destroyEntity(id: Entity): void {
		if (this.entities.has(id)) {
			this.entities.delete(id);
			this.recycledIds.push(id);
		}
	}

	entityExist(id: Entity): boolean {
		return this.entities.has(id);
	}

	getAllEntities(): ReadonlySet<Entity> {
		return this.entities;
	}

	clear(): void {
		this.entities.clear();
		this.recycledIds.clear();
		this.nextId = 1;
	}
}
