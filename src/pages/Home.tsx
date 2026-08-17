import { CameraCanvas } from '../components/CameraCanvas'
import { CameraControls } from '../components/CameraControls'
import { CameraStatus } from '../components/CameraStatus'
import { useCamera } from '../hooks/useCamera'

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Zm8.445-7.188L18 9.75l-.258-1.034a3.375 3.375 0 0 0-2.458-2.458L14.25 6l1.034-.258a3.375 3.375 0 0 0 2.458-2.458L18 2.25l.258 1.034a3.375 3.375 0 0 0 2.458 2.458L21.75 6l-1.034.258a3.375 3.375 0 0 0-2.458 2.458Z" />
    </svg>
  )
}

export function Home() {
  const { stream, status, error, startCamera, stopCamera } = useCamera()
  const isActive = status === 'active'
  const isStarting = status === 'starting'

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080a0c] text-zinc-100 selection:bg-emerald-400/25">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-15%,rgba(60,85,76,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.016)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.016)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1040px] flex-col px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
        <header className="flex items-center justify-between border-b border-white/8 pb-7">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/8 text-emerald-300">
              <SparkIcon />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">AI Invisibility Lab</h1>
              <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">Real-time computer vision experiment</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-white/8 bg-white/3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 sm:block">
            Phase 02
          </span>
        </header>

        <section className="flex flex-1 flex-col justify-center py-10 sm:py-14" aria-labelledby="camera-heading">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Canvas output</p>
              <h2 id="camera-heading" className="text-2xl font-semibold tracking-[-0.025em] text-white sm:text-3xl">
                Real-time renderer
              </h2>
            </div>
            <CameraStatus status={status} />
          </div>

          <CameraCanvas stream={stream} cameraStatus={status} error={error} />

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-400/15 bg-rose-400/7 px-4 py-3.5 text-sm leading-6 text-rose-100" role="alert">
              <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-rose-300" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374l7.355-12.75c.866-1.5 3.03-1.5 3.896 0l7.355 12.75ZM12 15.75h.008v.008H12v-.008Z" />
              </svg>
              <p>{error}</p>
            </div>
          )}

          <CameraControls
            isActive={isActive}
            isStarting={isStarting}
            onStart={startCamera}
            onStop={stopCamera}
          />
        </section>

        <footer className="grid gap-5 border-t border-white/8 pt-7 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs text-emerald-300">02</span>
              <h2 className="text-sm font-semibold text-zinc-200">Real-time canvas rendering</h2>
            </div>
            <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500">
              Camera frames now flow through a browser-only canvas pipeline prepared for future visual overlays.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-xs text-zinc-500 sm:items-end">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-zinc-600" />
              AI tracking: Not enabled
            </div>
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-zinc-600" />
              Segmentation: Not enabled
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
