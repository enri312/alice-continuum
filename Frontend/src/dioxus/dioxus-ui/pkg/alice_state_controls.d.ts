/* tslint:disable */
/* eslint-disable */
export function unmount_cognitive_flow(id: number): void;
export function update_cognitive_flow(id: number, raw: string): void;
export function mount_cognitive_flow(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function unmount_dashboard(id: number): void;
export function update_dashboard(id: number, raw: string): void;
export function mount_dashboard(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function unmount_flow_page(id: number): void;
export function update_flow_page(id: number, raw: string): void;
export function mount_flow_page(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function unmount_saved_relations(id: number): void;
export function update_saved_relations(id: number, raw: string): void;
export function mount_saved_relations(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function unmount_audit_page(id: number): void;
export function update_audit_page(id: number, raw: string): void;
export function mount_audit_page(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function unmount_navigation(id: number): void;
export function update_navigation(id: number, raw: string): void;
export function mount_navigation(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function unmount_source_form(id: number): void;
export function update_source_form(id: number, raw: string): void;
export function mount_source_form(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function unmount_memory_associations(id: number): void;
export function update_memory_associations(id: number, raw: string): void;
export function mount_memory_associations(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function unmount_relation_confirmation(id: number): void;
export function update_relation_confirmation(id: number, raw: string): void;
export function mount_relation_confirmation(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function unmount_activity_page(id: number): void;
export function update_activity_page(id: number, raw: string): void;
export function mount_activity_page(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function unmount_conversation_page(id: number): void;
export function update_conversation_page(id: number, raw: string): void;
export function mount_conversation_page(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function unmount_state_controls(id: number): void;
export function update_state_controls(id: number, raw: string): void;
export function mount_state_controls(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function update_memory_session(raw: string): string;
export function apply_activity_batch(raw: string): string;
export function update_learning_session(raw: string): string;
export function update_observation_session(raw: string): string;
export function init_conversation_session(raw: string): string;
export function update_conversation_session(raw: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly apply_activity_batch: (a: number, b: number) => [number, number, number, number];
  readonly init_conversation_session: (a: number, b: number) => [number, number, number, number];
  readonly mount_activity_page: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly mount_audit_page: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly mount_cognitive_flow: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly mount_conversation_page: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly mount_dashboard: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly mount_flow_page: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly mount_memory_associations: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly mount_navigation: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly mount_relation_confirmation: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly mount_saved_relations: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly mount_source_form: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly mount_state_controls: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly unmount_activity_page: (a: number) => void;
  readonly unmount_audit_page: (a: number) => void;
  readonly unmount_cognitive_flow: (a: number) => void;
  readonly unmount_conversation_page: (a: number) => void;
  readonly unmount_dashboard: (a: number) => void;
  readonly unmount_flow_page: (a: number) => void;
  readonly unmount_memory_associations: (a: number) => void;
  readonly unmount_navigation: (a: number) => void;
  readonly unmount_relation_confirmation: (a: number) => void;
  readonly unmount_saved_relations: (a: number) => void;
  readonly unmount_source_form: (a: number) => void;
  readonly unmount_state_controls: (a: number) => void;
  readonly update_activity_page: (a: number, b: number, c: number) => [number, number];
  readonly update_audit_page: (a: number, b: number, c: number) => [number, number];
  readonly update_cognitive_flow: (a: number, b: number, c: number) => [number, number];
  readonly update_conversation_page: (a: number, b: number, c: number) => [number, number];
  readonly update_conversation_session: (a: number, b: number) => [number, number, number, number];
  readonly update_dashboard: (a: number, b: number, c: number) => [number, number];
  readonly update_flow_page: (a: number, b: number, c: number) => [number, number];
  readonly update_learning_session: (a: number, b: number) => [number, number, number, number];
  readonly update_memory_associations: (a: number, b: number, c: number) => [number, number];
  readonly update_memory_session: (a: number, b: number) => [number, number, number, number];
  readonly update_navigation: (a: number, b: number, c: number) => [number, number];
  readonly update_observation_session: (a: number, b: number) => [number, number, number, number];
  readonly update_relation_confirmation: (a: number, b: number, c: number) => [number, number];
  readonly update_saved_relations: (a: number, b: number, c: number) => [number, number];
  readonly update_source_form: (a: number, b: number, c: number) => [number, number];
  readonly update_state_controls: (a: number, b: number, c: number) => [number, number];
  readonly wasm_bindgen_dce4ae8b940e967c___convert__closures________invoke___web_sys_fa9d3aca4c911a8___features__gen_Event__Event_____: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen_dce4ae8b940e967c___closure__destroy___dyn_for__a__core_37ee0ce0c4cd57d5___ops__function__Fn____a_web_sys_fa9d3aca4c911a8___features__gen_Event__Event____Output_______: (a: number, b: number) => void;
  readonly wasm_bindgen_dce4ae8b940e967c___convert__closures_____invoke______: (a: number, b: number) => void;
  readonly wasm_bindgen_dce4ae8b940e967c___convert__closures_____invoke___wasm_bindgen_dce4ae8b940e967c___JsValue_____: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen_dce4ae8b940e967c___closure__destroy___dyn_core_37ee0ce0c4cd57d5___ops__function__FnMut__wasm_bindgen_dce4ae8b940e967c___JsValue____Output_______: (a: number, b: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __externref_drop_slice: (a: number, b: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
