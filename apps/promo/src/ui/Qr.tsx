/** A QR-looking grid (deterministic noise + finder squares). Decorative — it is not a real code. */
export const Qr = ({ size, seed = 7, cells = 25 }: { size: number; seed?: number; cells?: number }) => {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const cell = size / cells;
  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
    let on = rnd() > 0.52;
    if (finder(r, c)) {
      const rr = r < 7 ? r : r - (cells - 7), cc = c < 7 ? c : c - (cells - 7);
      const edge = rr === 0 || rr === 6 || cc === 0 || cc === 6;
      const core = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
      on = edge || core;
    }
    if (on) rects.push(<rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell + 0.3} height={cell + 0.3} fill="#1B1815" />);
  }
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>{rects}</svg>;
};
