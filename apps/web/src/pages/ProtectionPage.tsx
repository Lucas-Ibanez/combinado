export default function ProtectionPage() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center mb-4">
        <span className="text-brand text-xl">🛡</span>
      </div>
      <h1 className="text-xl font-bold text-text mb-2">Proteção</h1>
      <p className="text-text-muted text-sm max-w-xs mb-6">
        Aqui você verá o estado da proteção da sua família — dispositivos vinculados e monitoramento ativo.
      </p>
      <button
        type="button"
        disabled
        className="bg-brand text-brand-foreground font-medium text-sm py-2.5 px-6 rounded-lg opacity-50 cursor-not-allowed"
      >
        Vincular dispositivo
      </button>
      <p className="text-xs text-text-muted mt-2">Disponível em breve</p>
    </div>
  )
}
