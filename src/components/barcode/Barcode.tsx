import { useMemo } from 'react';

/**
 * Self-contained CODE128B barcode renderer (no external dependency).
 * Encodes printable ASCII (32..126) with a modulo-103 checksum and the
 * standard start/stop bars. Output is pure SVG that prints cleanly and
 * scans with any standard barcode reader.
 */

// All 107 CODE128 bar patterns (indices 0..106). Each value is 11 modules
// of 1 (bar) / 0 (space), except STOP (106) which is 13 modules.
// Source: ISO/IEC 15417 (via jsbarcode constants).
const BARS: number[] = [
  11011001100, 11001101100, 11001100110, 10010011000, 10010001100, // 0..4
  10001001100, 10011001000, 10011000100, 10001100100, 11001001000, // 5..9
  11001000100, 11000100100, 10110011100, 10011011100, 10011001110, // 10..14
  10111001100, 10011101100, 10011100110, 11001110010, 11001011100, // 15..19
  11001001110, 11011100100, 11001110100, 11101101110, 11101001100, // 20..24
  11100101100, 11100100110, 11101100100, 11100110100, 11100110010, // 25..29
  11011011000, 11011000110, 11000110110, 10100011000, 10001011000, // 30..34
  10001000110, 10110001000, 10001101000, 10001100010, 11010001000, // 35..39
  11000101000, 11000100010, 10110111000, 10110001110, 10001101110, // 40..44
  10111011000, 10111000110, 10001110110, 11101110110, 11010001110, // 45..49
  11000101110, 11011101000, 11011100010, 11011101110, 11101011000, // 50..54
  11101000110, 11100010110, 11101101000, 11101100010, 11100011010, // 55..59
  11101111010, 11001000010, 11110001010, 10100110000, 10100001100, // 60..64
  10010110000, 10010000110, 10000101100, 10000100110, 10110010000, // 65..69
  10110000100, 10011010000, 10011000010, 10000110100, 10000110010, // 70..74
  11000010010, 11001010000, 11110111010, 11000010100, 10001111010, // 75..79
  10100111100, 10010111100, 10010011110, 10111100100, 10011110100, // 80..84
  10011110010, 11110100100, 11110010100, 11110010010, 11011011110, // 85..89
  11011110110, 11110110110, 10101111000, 10100011110, 10001011110, // 90..94
  10111101000, 10111100010, 11110101000, 11110100010, 10111011110, // 95..99
  10111101110, 11101011110, 11110101110, 11010000100, 11010010000, // 100..104 (100=CODE_C, 101=CODE_A, 102=FNC, 103=START_A, 104=START_B)
  11010011100, 1100011101011,                                       // 105=START_C, 106=STOP
];

const START_B = 104;
const MODULO = 103;
const STOP = 106;

function barString(idx: number): string {
  return (BARS[idx] ?? 0).toString(2);
}

function encodeCode128B(value: string): string {
  // CODE128B: symbol index = charCode - 32 (valid for printable ASCII 32..126 -> 0..94).
  let bars = barString(START_B);
  let checksum = START_B;
  let weight = 1;

  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) continue; // skip non-printable / non-ASCII
    const idx = code - 32;
    bars += barString(idx);
    checksum += idx * weight;
    weight++;
  }

  const checkDigit = checksum % MODULO;
  bars += barString(checkDigit);
  bars += barString(STOP);
  return bars;
}

interface BarcodeProps {
  value: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  className?: string;
}

export default function Barcode({
  value,
  width = 2,
  height = 60,
  displayValue = true,
  className,
}: BarcodeProps) {
  const bars = useMemo(() => (value ? encodeCode128B(value) : ''), [value]);

  if (!value || !bars) return null;

  // Group consecutive same bits into runs for compact SVG.
  const modules: { x: number; w: number; black: boolean }[] = [];
  let x = 0;
  let i = 0;
  while (i < bars.length) {
    const bit = bars[i];
    let run = 0;
    while (i < bars.length && bars[i] === bit) {
      run++;
      i++;
    }
    modules.push({ x, w: run * width, black: bit === '1' });
    x += run * width;
  }

  const totalWidth = x;
  const labelHeight = displayValue ? 18 : 0;

  return (
    <svg
      className={className}
      width={totalWidth}
      height={height + labelHeight}
      viewBox={`0 0 ${totalWidth} ${height + labelHeight}`}
      role="img"
      aria-label={`Barcode ${value}`}
    >
      <rect x={0} y={0} width={totalWidth} height={height} fill="#ffffff" />
      {modules.map((m, idx) =>
        m.black ? <rect key={idx} x={m.x} y={0} width={m.w} height={height} fill="#0f172a" /> : null,
      )}
      {displayValue && (
        <text
          x={totalWidth / 2}
          y={height + 14}
          textAnchor="middle"
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
          fontSize={13}
          fill="#0f172a"
        >
          {value}
        </text>
      )}
    </svg>
  );
}
