interface Props {
  onCreateNote: () => void
  onSearch: () => void
  onProposals: () => void
  onSettings: () => void
  onStats: () => void
  onClear: () => void
  captureOpen: boolean
  proposalsOpen: boolean
  settingsOpen: boolean
  statsOpen: boolean
}

export function FooterBar({
  onCreateNote,
  onSearch,
  onProposals,
  onSettings,
  onStats,
  onClear,
  captureOpen,
  proposalsOpen,
  settingsOpen,
  statsOpen,
}: Props) {
  const buttonClass = (isActive: boolean) =>
    `flex flex-col items-center justify-center px-4 py-2 cursor-pointer ${
      isActive
        ? 'text-[#268bd2] bg-[#fdf6e3]'
        : 'text-[#586e75] hover:text-[#268bd2] hover:bg-[#fdf6e3]'
    }`

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#eee8d5] border-t border-[#93a1a1] flex items-center justify-around h-[50px]">
      <button
        onClick={onCreateNote}
        className={buttonClass(captureOpen)}
        title="Create Note"
      >
        <span className="text-xl"></span>
        <span className="text-xs mt-1">Create</span>
      </button>

      <button
        onClick={onSearch}
        className={buttonClass(false)}
        title="Search"
      >
        <span className="text-xl"></span>
        <span className="text-xs mt-1">Search</span>
      </button>

      <button
        onClick={onProposals}
        className={buttonClass(proposalsOpen)}
        title="Edge Proposals"
      >
        <span className="text-xl"></span>
        <span className="text-xs mt-1">Links</span>
      </button>

      <button
        onClick={onSettings}
        className={buttonClass(settingsOpen)}
        title="Settings"
      >
        <span className="text-xl"></span>
        <span className="text-xs mt-1">Settings</span>
      </button>

      <button
        onClick={onStats}
        className={buttonClass(statsOpen)}
        title="Statistics"
      >
        <span className="text-xl"></span>
        <span className="text-xs mt-1">Stats</span>
      </button>

      <button
        onClick={onClear}
        className={buttonClass(false)}
        title="Clear Highlights"
      >
        <span className="text-xl"></span>
        <span className="text-xs mt-1">Clear</span>
      </button>
    </div>
  )
}
