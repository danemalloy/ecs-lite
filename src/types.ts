export type Entity = number;

export interface Component {
	readonly __componentBrand?: never;
}

export type ComponentClass<T extends Component = Component> = new (...args: never[]) => T;
export type ComponentQuery = ComponentClass[];

export type ComponentId = number;

export interface Archetype {
	readonly signature: ComponentId[];
	readonly entities: Entity[];
	readonly componentArrays: Map<ComponentId, Component[]>;
}

export interface QueryCache {
	readonly signature: ComponentId[];
	entities: Entity[];
	archetypes: Set<Archetype>;
	needsUpdate: boolean;
}
