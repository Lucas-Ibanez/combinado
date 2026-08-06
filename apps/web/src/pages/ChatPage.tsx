export default function ChatPage() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-12 h-12 rounded-full bg-brand-surface flex items-center justify-center mb-4">
        <span className="text-brand text-xl">💬</span>
      </div>
      <h1 className="text-xl font-bold text-text mb-2">Chat de Verificação</h1>
      <p className="text-text-muted text-sm max-w-xs mb-6">
        Use este canal seguro para confirmar a identidade de quem entrou em contato com sua família.
      </p>
      <button
        type="button"
        disabled
        className="bg-brand text-brand-foreground font-medium text-sm py-2.5 px-6 rounded-lg opacity-50 cursor-not-allowed"
      >
        Iniciar verificação
      </button>
      <p className="text-xs text-text-muted mt-2">Disponível em breve</p>
    </div>
  )
}
