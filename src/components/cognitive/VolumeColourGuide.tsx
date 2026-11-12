import { memoryLayerLegend, memoryVisualStates } from "../../core/cognitive/cognitive-volume";
import { affectPalette } from "../../core/cognitive/affect";

/** Uses the same palette and state markers as the canvas and the selected record. */
export function VolumeColourGuide() {
  return <details className="volume-color-guide"><summary>Colores de los recuerdos</summary>
    <div className="volume-colour-guide-content">
      <section><h4>Relleno por tipo</h4><p>Cuando no hay una asociación emocional confirmada y vigente, el relleno muestra el tipo de memoria.</p>
        <div className="volume-layer-legend" aria-label="Tipos de memoria">{memoryLayerLegend.map(layer => <span key={layer.id} data-layer={layer.id} style={{ color: `rgb(${layer.color.join(",")})` }}><i style={{ backgroundColor: `rgb(${layer.color.join(",")})` }} />{layer.label}</span>)}</div>
      </section>
      <section><h4>Relleno con asociación emocional revisada</h4><p>Usa la emoción registrada con evidencia. Si hay varias, mezcla sus colores según las intensidades guardadas; la ficha explica el tono resultante.</p>
        <div className="volume-affect-legend" aria-label="Colores de las asociaciones emocionales">{affectPalette.map(affect => <span key={affect.id} data-affect={affect.id}><i style={{ backgroundColor: affect.color }} />{affect.label}</span>)}</div>
        <small>Son asociaciones del recuerdo revisadas por el propietario; no sentimientos atribuidos a Alice.</small>
      </section>
      <section><h4>Contorno y estado</h4><p>El estado cambia el contorno o la atenuación y conserva el relleno. La ficha muestra todos los estados; el contorno usa el primero que corresponda en este orden.</p>
        <div className="volume-state-legend" aria-label="Marcas de estado de los recuerdos">{memoryVisualStates.map(state => <span key={state.id} data-state={state.id}><svg viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke={`rgb(${state.color.join(",")})`} strokeWidth="1.5" strokeDasharray={state.dash.join(" ")} /></svg>{state.label}</span>)}</div>
      </section>
      <section><h4>Recuperación y selección</h4><p><i className="volume-retrieval-key" /> Un anillo blanco señala recuperación actual, selección o el puntero sobre un nodo. El relleno permanece igual; la ficha indica si el recuerdo fue recuperado. Los rombos representan procesos y conservan su propia codificación.</p></section>
    </div>
  </details>;
}
