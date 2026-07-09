import React, { useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BracketMatch {
  bracketId: string;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  matchId: string | null;
}

export interface BracketRound {
  roundNumber: number;
  roundName: string;
  phase: string;
  matches: BracketMatch[];
}

export interface TournamentBracketData {
  totalRounds: number;
  rounds: BracketRound[];
}

export interface BracketParticipant {
  userId: string;
  nickname: string;
}

interface Props {
  bracket: TournamentBracketData;
  participants: BracketParticipant[];
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const MATCH_W   = 168;
const SLOT_H    = 30;
const SLOT_GAP  = 10;
const PAD_V     = 10;
const MATCH_H   = PAD_V + SLOT_H + SLOT_GAP + SLOT_H + PAD_V; // = 80
const COL_GAP   = 56;
const COL_STEP  = MATCH_W + COL_GAP;
const BASE_SLOT = MATCH_H + 12;

// ─── Phase label fallback (quando roundName não vem do backend) ───────────────

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    ROUND_1: 'Rodada 1', ROUND_2: 'Rodada 2', ROUND_3: 'Rodada 3',
    ROUND_4: 'Rodada 4', ROUND_5: 'Rodada 5',
    QUARTERFINAL: 'Quartas', SEMIFINAL: 'Semifinal', FINAL: 'Final',
    THIRD: '3º Lugar', THIRD_PLACE: '3º Lugar', DUEL: 'Duelo',
  };
  return map[phase] ?? phase;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const C = {
  surface:   '#1e1e2e',
  surface2:  '#2a2a3d',
  border:    '#3a3a4e',
  primary:   '#6c63ff',
  primaryDim:'rgba(108,99,255,0.15)',
  text:      '#e0e0f0',
  muted:     '#888',
  win:       '#22c55e',
  winDim:    'rgba(34,197,94,0.12)',
  tbd:       '#555',
  connector: '#3a3a4e',
  header:    '#252535',
};

// ─── Helper: player name from map ─────────────────────────────────────────────

function pName(id: string | null, map: Map<string, string>): string {
  if (!id) return 'TBD';
  return map.get(id) ?? id.slice(0, 8);
}

// ─── Bracket component ────────────────────────────────────────────────────────

export function TournamentBracket({ bracket, participants }: Props) {
  const playerMap = useMemo(() => {
    const m = new Map<string, string>();
    participants.forEach(p => m.set(p.userId, p.nickname));
    return m;
  }, [participants]);

  const mainRounds = useMemo(
    () => bracket.rounds.filter(r => r.phase !== 'THIRD'),
    [bracket.rounds],
  );
  const thirdRound = useMemo(
    () => bracket.rounds.find(r => r.phase === 'THIRD'),
    [bracket.rounds],
  );

  const numRound1 = mainRounds[0]?.matches.length ?? 1;
  const totalMainRounds = mainRounds.length;
  const svgH = BASE_SLOT * numRound1;
  const svgW = totalMainRounds * COL_STEP + MATCH_W;

  // y center of match (roundIdx, matchIdx) in the SVG
  function matchCenterY(roundIdx: number, matchIdx: number): number {
    const slotH = BASE_SLOT * Math.pow(2, roundIdx);
    return matchIdx * slotH + slotH / 2;
  }

  function matchTopY(roundIdx: number, matchIdx: number): number {
    return matchCenterY(roundIdx, matchIdx) - MATCH_H / 2;
  }

  function matchX(roundIdx: number): number {
    return roundIdx * COL_STEP;
  }

  // connector line from right edge of (ri, mi) to left edge of parent (ri+1, pi)
  function connectorPath(ri: number, mi: number): string {
    const x1 = matchX(ri) + MATCH_W;
    const y1 = matchCenterY(ri, mi);
    const pi = Math.floor(mi / 2);
    const x2 = matchX(ri + 1);
    const y2 = matchCenterY(ri + 1, pi);
    const midX = x1 + COL_GAP / 2;
    return `M${x1},${y1} H${midX} V${y2} H${x2}`;
  }

  // draw a single match card as SVG
  function renderMatch(
    match: BracketMatch,
    ri: number,
    mi: number,
    isThird = false,
  ) {
    const x  = matchX(ri);
    const y  = matchTopY(ri, mi);
    const p1 = pName(match.player1Id, playerMap);
    const p2 = pName(match.player2Id, playerMap);
    const w  = match.winnerId;
    const p1Win = w !== null && w === match.player1Id;
    const p2Win = w !== null && w === match.player2Id;
    const isTbd1 = !match.player1Id;
    const isTbd2 = !match.player2Id;

    const slot1Y = y + PAD_V;
    const slot2Y = y + PAD_V + SLOT_H + SLOT_GAP;

    // truncate names
    const name1 = p1.length > 16 ? p1.slice(0, 15) + '…' : p1;
    const name2 = p2.length > 16 ? p2.slice(0, 15) + '…' : p2;

    return (
      <g key={`${match.bracketId}-${isThird}`}>
        {/* Card shadow rect */}
        <rect x={x+2} y={y+2} width={MATCH_W} height={MATCH_H} rx={8}
          fill="rgba(0,0,0,0.3)" />
        {/* Card background */}
        <rect x={x} y={y} width={MATCH_W} height={MATCH_H} rx={8}
          fill={C.surface} stroke={isThird ? 'rgba(255,160,0,0.4)' : C.border} strokeWidth={1.5} />

        {/* Slot 1 background */}
        <rect x={x+6} y={slot1Y} width={MATCH_W-12} height={SLOT_H} rx={5}
          fill={p1Win ? C.winDim : isTbd1 ? 'transparent' : C.surface2} />
        {/* Slot 1 text */}
        <text x={x+14} y={slot1Y + SLOT_H / 2 + 5}
          fontSize={12} fontFamily="DM Sans, sans-serif"
          fill={p1Win ? C.win : isTbd1 ? C.tbd : C.text}
          fontWeight={p1Win ? '700' : '400'}>
          {name1}
        </text>
        {p1Win && (
          <text x={x+MATCH_W-20} y={slot1Y + SLOT_H/2 + 5}
            fontSize={11} fill={C.win} textAnchor="middle">★</text>
        )}

        {/* Divider */}
        <line x1={x+6} y1={slot1Y + SLOT_H + SLOT_GAP/2} x2={x+MATCH_W-6} y2={slot1Y + SLOT_H + SLOT_GAP/2}
          stroke={C.border} strokeWidth={0.8} />

        {/* Slot 2 background */}
        <rect x={x+6} y={slot2Y} width={MATCH_W-12} height={SLOT_H} rx={5}
          fill={p2Win ? C.winDim : isTbd2 ? 'transparent' : C.surface2} />
        {/* Slot 2 text */}
        <text x={x+14} y={slot2Y + SLOT_H / 2 + 5}
          fontSize={12} fontFamily="DM Sans, sans-serif"
          fill={p2Win ? C.win : isTbd2 ? C.tbd : C.text}
          fontWeight={p2Win ? '700' : '400'}>
          {name2}
        </text>
        {p2Win && (
          <text x={x+MATCH_W-20} y={slot2Y + SLOT_H/2 + 5}
            fontSize={11} fill={C.win} textAnchor="middle">★</text>
        )}
      </g>
    );
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
      {/* Main bracket */}
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width={svgW} height={svgH}
        style={{ display: 'block', minWidth: svgW }}
      >
        {/* Round headers */}
        {mainRounds.map((round, ri) => (
          <g key={`header-${ri}`}>
            <rect x={matchX(ri)} y={0} width={MATCH_W} height={22} rx={4} fill={C.header} />
            <text
              x={matchX(ri) + MATCH_W / 2} y={15}
              textAnchor="middle" fontSize={11}
              fontFamily="DM Sans, sans-serif"
              fill={C.muted} fontWeight="600"
              letterSpacing="0.05em"
            >
              {(round.roundName ?? phaseLabel(round.phase)).toUpperCase()}
            </text>
          </g>
        ))}

        {/* Connector lines (behind cards) */}
        {mainRounds.map((round, ri) =>
          ri < totalMainRounds - 1
            ? round.matches.map((_, mi) => (
                <path
                  key={`conn-${ri}-${mi}`}
                  d={connectorPath(ri, mi)}
                  fill="none" stroke={C.connector} strokeWidth={1.5}
                  strokeLinecap="round"
                />
              ))
            : null,
        )}

        {/* Match cards */}
        {mainRounds.map((round, ri) =>
          round.matches.map((match, mi) => renderMatch(match, ri, mi)),
        )}
      </svg>

      {/* 3rd place match */}
      {thirdRound && thirdRound.matches[0] && (
        <div style={{ marginTop: 20 }}>
          <p style={{
            fontSize: 11, fontWeight: 700, color: '#f0a800',
            letterSpacing: '0.07em', marginBottom: 8,
          }}>
            🥉 DISPUTA DE 3º LUGAR
          </p>
          <svg
            viewBox={`0 0 ${MATCH_W} ${MATCH_H}`}
            width={MATCH_W} height={MATCH_H}
            style={{ display: 'block' }}
          >
            {renderMatch(thirdRound.matches[0], 0, 0, true)}
          </svg>
        </div>
      )}
    </div>
  );
}
