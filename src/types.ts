export type Entity = number;
export type Component = Record<string, unknown>;
export type ComponentClass<T extends Component = Component> = new (...args: unknown[]) => T;
export type ComponentQuest = ComponentClass[];
