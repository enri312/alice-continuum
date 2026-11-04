import { describe, expect, it, vi } from "vitest";
import { VisionSession, type CameraHandle, type VisionServices } from "./vision-session";
const deferred = <T,>() => { let resolve!: (value:T)=>void; const promise=new Promise<T>(r=>{resolve=r;}); return {promise,resolve}; };
function harness(overrides: Partial<VisionServices> = {}) {
  const camera:CameraHandle={capture:vi.fn(async()=>"png"),close:vi.fn()};
  let counter=0;
  const services:VisionServices={openCamera:vi.fn(async()=>camera),begin:vi.fn(async()=>`session-${++counter}`),end:vi.fn(async()=>{}),...overrides};
  return {camera,services,session:new VisionSession(services)};
}
describe("sesión visual de conversación",()=>{
  it("permanece apagada y toma una imagen nueva por turno mientras está activa",async()=>{
    const {session,camera,services}=harness();
    expect(await session.capture()).toBeUndefined(); expect(services.openCamera).not.toHaveBeenCalled();
    await session.start({camera:true,desktop:true});
    expect(await session.capture()).toMatchObject({sessionId:"session-1",desktop:true,camera:{imageBase64:"png"}});
    await session.capture(); expect(camera.capture).toHaveBeenCalledTimes(2);
    await session.stop(); expect(camera.close).toHaveBeenCalledOnce(); expect(services.end).toHaveBeenCalledWith("session-1");
    expect(await session.capture()).toBeUndefined();
  });
  it("cierra un permiso de cámara que llega después de detener",async()=>{
    const permission=deferred<CameraHandle>(); const {session,camera,services}=harness({openCamera:()=>permission.promise});
    const start=session.start({camera:true,desktop:false}); await session.stop(); permission.resolve(camera);
    expect(await start).toBe(false); expect(camera.close).toHaveBeenCalledOnce(); expect(services.begin).not.toHaveBeenCalled();
  });
  it("revoca una sesión nativa que termina de iniciarse después de detener",async()=>{
    const begin=deferred<string>();const {session,services}=harness({begin:()=>begin.promise});
    const start=session.start({camera:false,desktop:true}); await session.stop(); begin.resolve("late");
    expect(await start).toBe(false);expect(services.end).toHaveBeenCalledWith("late");expect(session.current).toBeNull();
  });
  it("no reinicia la cámara si se detuvo mientras se cerraba la sesión anterior",async()=>{
    const end=deferred<void>(); const {session,services}=harness();await session.start({camera:false,desktop:true});
    services.end=vi.fn(()=>end.promise);
    const start=session.start({camera:true,desktop:true}); await session.stop();end.resolve();
    expect(await start).toBe(false);expect(services.openCamera).not.toHaveBeenCalled();
  });
  it("descarta una captura tardía y cierra la cámara ante fallos nativos",async()=>{
    const take=deferred<string>(); const {session,camera}=harness(); camera.capture=()=>take.promise;
    await session.start({camera:true,desktop:false});const pending=session.capture();await session.stop();take.resolve("late");
    await expect(pending).rejects.toThrow("cambió");
    const broken=harness({begin:async()=>{throw Error("native failed");}});
    await expect(broken.session.start({camera:true,desktop:false})).rejects.toThrow("native failed");expect(broken.camera.close).toHaveBeenCalledOnce();
  });
});
