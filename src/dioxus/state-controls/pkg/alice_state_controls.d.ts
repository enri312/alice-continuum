/* tslint:disable */
/* eslint-disable */
export function mount_state_controls(root: string, raw: string, on_action: Function, on_ready: Function): number;
export function update_state_controls(id: number, raw: string): void;
export function unmount_state_controls(id: number): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly mount_state_controls: (a: number, b: number, c: number, d: number, e: any, f: any) => [number, number, number];
  readonly unmount_state_controls: (a: number) => void;
  readonly update_state_controls: (a: number, b: number, c: number) => [number, number];
  readonly wasm_bindgen_dce4ae8b940e967c___convert__closures________invoke___web_sys_fa9d3aca4c911a8___features__gen_Event__Event_____: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen_dce4ae8b940e967c___closure__destroy___dyn_for__a__core_37ee0ce0c4cd57d5___ops__function__Fn____a_web_sys_fa9d3aca4c911a8___features__gen_Event__Event____Output_______: (a: number, b: number) => void;
  readonly wasm_bindgen_dce4ae8b940e967c___convert__closures_____invoke___wasm_bindgen_dce4ae8b940e967c___JsValue_____: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen_dce4ae8b940e967c___closure__destroy___dyn_core_37ee0ce0c4cd57d5___ops__function__FnMut__wasm_bindgen_dce4ae8b940e967c___JsValue____Output_______: (a: number, b: number) => void;
  readonly wasm_bindgen_dce4ae8b940e967c___convert__closures_____invoke______: (a: number, b: number) => void;
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
