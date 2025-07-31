import { ComponentManager } from "./component";
import { EntityManager } from "./entity";
import { System, SystemManager } from "./system";
import { Component, ComponentClass, ComponentQuest, Entity } from "./types";
import { World } from "./world";

export { Entity, Component, ComponentClass, ComponentQuest } from "./types";
export { EntityManager } from "./entity";
export { ComponentManager } from "./component";
export { System, SystemManager } from "./system";
export { World } from "./world";

export default {
	World,
	Entity: undefined as unknown as Entity,
	EntityManager,
	Component: undefined as unknown as Component,
	ComponentClass: undefined as unknown as ComponentClass,
	ComponentQuest: undefined as unknown as ComponentQuest,
	ComponentManager,
	System: undefined as unknown as System,
	SystemManager,
};
