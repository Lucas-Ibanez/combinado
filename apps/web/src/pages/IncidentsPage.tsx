export default function IncidentsPage() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-12 h-12 rounded-full bg-attention-surface flex items-center justify-center mb-4">
        <span className="text-attention text-xl">🔔</span>
      </div>
      <h1 className="text-xl font-bold text-text mb-2">Nenhum alerta no momento</h1>
      <p className="text-text-muted text-sm max-w-xs mb-6">
        Quando algo suspeito for detectado, você verá os alertas aqui com todos os detalhes para agir.
      </p>
      <button
        type="button"
        disabled
        className="bg-attention text-attention-foreground font-medium text-sm py-2.5 px-6 rounded-lg opacity-50 cursor-not-allowed"
      >
        Revisar alerta
      </button>
      <p className="text-xs text-text-muted mt-2">Nenhum pendente</p>
    </div>
  )
}
