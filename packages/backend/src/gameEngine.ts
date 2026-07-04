/**
 * @synchro/backend — Game Session Engine
 *
 * Manages puzzle selection, role assignment, and per-operator view generation.
 * When a room starts a game, this engine:
 *   1. Selects a random puzzle from the master database
 *   2. Shuffles and assigns the 3 operator roles to the 3 connected players
 *   3. Builds personalized GameStartedPayload for each player
 *   4. Ensures no operator ever receives another operator's view data
 */

import {
  PUZZLE_DATABASE,
  OPERATOR_ROLES,
  OPERATOR_LABELS,
  type MasterPuzzle,
  type Player,
  type OperatorRole,
  type RoleAssignment,
  type GameSession,
  type GameStartedPayload,
  type OperatorView,
} from "@synchro/shared";

// ─── Active Sessions ────────────────────────────────────────────────

/** In-memory map of roomId → active GameSession */
const activeSessions: Map<string, GameSession> = new Map();

// ─── Fisher-Yates Shuffle ───────────────────────────────────────────

/**
 * Returns a new array with elements in a cryptographically-unbiased random order.
 * Uses the Fisher-Yates (Durstenfeld) algorithm.
 */
function shuffle<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ─── Puzzle Selection ───────────────────────────────────────────────

/**
 * Selects a random puzzle from the master database.
 * In the future this can be extended with weighted selection,
 * history tracking to avoid repeats, or difficulty scaling.
 */
function selectRandomPuzzle(): MasterPuzzle {
  const index = Math.floor(Math.random() * PUZZLE_DATABASE.length);
  return PUZZLE_DATABASE[index];
}

// ─── Role Assignment ────────────────────────────────────────────────

/**
 * Randomly assigns each of the 3 players to a unique operator role.
 * The roles are shuffled so no player gets a predictable assignment.
 */
function assignRoles(players: Player[]): RoleAssignment[] {
  const shuffledRoles = shuffle(OPERATOR_ROLES);

  return players.map((player, index) => ({
    socketId: player.socketId,
    playerId: player.id,
    playerName: player.name,
    role: shuffledRoles[index],
  }));
}

// ─── View Builder ───────────────────────────────────────────────────

/**
 * Builds the OperatorView for a specific role from a puzzle.
 * This is the ONLY function that extracts view data — ensuring
 * each operator only receives their own lines.
 */
function buildOperatorView(
  puzzle: MasterPuzzle,
  role: OperatorRole
): OperatorView {
  const lines = puzzle.views[role];
  return {
    role,
    roleLabel: OPERATOR_LABELS[role],
    lines: lines.map((line) => ({
      lineNumber: line.lineNumber,
      content: line.content,
      isMismatchLine: line.isMismatchLine,
      indent: line.indent,
    })),
  };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Creates a new game session for a room.
 *
 * @param roomId - The room ID to create the session for
 * @param players - The 3 connected players in the room
 * @returns An array of [socketId, GameStartedPayload] tuples,
 *          one per player, ready to be emitted individually
 */
export function createGameSession(
  roomId: string,
  players: Player[]
): Array<[string, GameStartedPayload]> {
  // Select puzzle and assign roles
  const puzzle = selectRandomPuzzle();
  const assignments = assignRoles(players);

  // Build the session record
  const session: GameSession = {
    roomId,
    puzzleId: puzzle.id,
    sharedAlert: puzzle.sharedAlert,
    puzzleTitle: puzzle.title,
    assignments,
    lockedLines: {},
    startedAt: Date.now(),
  };

  // Store the session
  activeSessions.set(roomId, session);

  console.log(
    `[ENGINE] Session created for room "${roomId}" — ` +
      `Puzzle: "${puzzle.title}" (${puzzle.id})`
  );
  assignments.forEach((a) => {
    console.log(
      `[ENGINE]   └─ ${a.playerName} → ${a.role} (${OPERATOR_LABELS[a.role]})`
    );
  });

  // Build the crew roster (visible to everyone, no view data)
  const crew = assignments.map((a) => ({
    playerName: a.playerName,
    role: a.role,
    roleLabel: OPERATOR_LABELS[a.role],
  }));

  // Build per-player payloads — each player ONLY gets their own view
  const payloads: Array<[string, GameStartedPayload]> = assignments.map(
    (assignment) => {
      const payload: GameStartedPayload = {
        session: {
          roomId: session.roomId,
          puzzleId: session.puzzleId,
          puzzleTitle: session.puzzleTitle,
          sharedAlert: session.sharedAlert,
          startedAt: session.startedAt,
        },
        assignment,
        view: buildOperatorView(puzzle, assignment.role),
        crew,
      };

      return [assignment.socketId, payload];
    }
  );

  return payloads;
}

/**
 * Retrieves the active session for a room, if one exists.
 */
export function getSession(roomId: string): GameSession | undefined {
  return activeSessions.get(roomId);
}

/**
 * Destroys the active session for a room (e.g., when a player disconnects).
 */
export function destroySession(roomId: string): boolean {
  const existed = activeSessions.has(roomId);
  if (existed) {
    activeSessions.delete(roomId);
    console.log(`[ENGINE] Session destroyed for room "${roomId}"`);
  }
  return existed;
}

/**
 * Returns the number of currently active game sessions.
 */
export function getActiveSessionCount(): number {
  return activeSessions.size;
}
