/** X de fechar, no canto de cima à direita das janelas de papel. */
export default function CloseButton({ onClick, label = "Fechar" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="absolute top-3 right-3 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#2b211c]/70 transition hover:bg-[#2b211c]/10 hover:text-[#2b211c]"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
      </svg>
    </button>
  );
}
