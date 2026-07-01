/**
 * @synchro/shared — Game Type Definitions & Puzzle Database
 *
 * Defines the MasterPuzzle schema and hardcoded puzzle bank used
 * by the Mismatch Engine to generate per-operator views.
 */

// ─── Operator Roles ─────────────────────────────────────────────────

/** The three operator roles in a Synchro session */
export type OperatorRole = "operator_1" | "operator_2" | "operator_3";

/** All valid operator roles for iteration */
export const OPERATOR_ROLES: readonly OperatorRole[] = [
  "operator_1",
  "operator_2",
  "operator_3",
] as const;

/** Human-readable labels for each operator role */
export const OPERATOR_LABELS: Record<OperatorRole, string> = {
  operator_1: "OPERATOR_01 // PRIMARY CONSOLE",
  operator_2: "OPERATOR_02 // SYSTEM LOGS",
  operator_3: "OPERATOR_03 // DATA MONITOR",
};

// ─── Code Line ──────────────────────────────────────────────────────

/** A single line of code/text displayed on an operator's screen */
export interface CodeLine {
  /** The line number as displayed in the editor gutter */
  lineNumber: number;
  /** The actual text content of this line */
  content: string;
  /** If true, this line contains the mismatch the operators need to find */
  isMismatchLine: boolean;
  /** Optional indent level for visual formatting (number of spaces) */
  indent: number;
}

// ─── Operator View ──────────────────────────────────────────────────

/** The data payload a single operator sees during a puzzle round */
export interface OperatorView {
  /** The operator role this view belongs to */
  role: OperatorRole;
  /** The label displayed in the operator's sidebar */
  roleLabel: string;
  /** The array of code/text lines this operator sees */
  lines: CodeLine[];
}

// ─── Master Puzzle ──────────────────────────────────────────────────

/** The complete puzzle template stored in the master database */
export interface MasterPuzzle {
  /** Unique puzzle identifier */
  id: string;
  /** Short human-readable title for logging/debugging */
  title: string;
  /** The category of mismatch (e.g., "data-type", "case-sensitivity") */
  category: string;
  /** The shared alert string displayed to ALL operators */
  sharedAlert: string;
  /** The three operator-specific views — each sees different data */
  views: Record<OperatorRole, CodeLine[]>;
}

// ─── Game Session ───────────────────────────────────────────────────

/** Maps a player's socket ID to their assigned operator role */
export interface RoleAssignment {
  socketId: string;
  playerId: string;
  playerName: string;
  role: OperatorRole;
}

/** The full game session state for a room */
export interface GameSession {
  /** The room this session belongs to */
  roomId: string;
  /** The selected puzzle for this round */
  puzzleId: string;
  /** The shared alert visible to all operators */
  sharedAlert: string;
  /** The puzzle title (for logging) */
  puzzleTitle: string;
  /** Role assignments mapping each player to an operator */
  assignments: RoleAssignment[];
  /** Timestamp when the session started */
  startedAt: number;
}

// ─── Socket Payloads (Game Phase) ───────────────────────────────────

/** Payload sent to EACH client individually when the game starts */
export interface GameStartedPayload {
  /** The session metadata */
  session: {
    roomId: string;
    puzzleId: string;
    puzzleTitle: string;
    sharedAlert: string;
    startedAt: number;
  };
  /** YOUR specific operator assignment */
  assignment: RoleAssignment;
  /** YOUR specific view data — only your lines, never another operator's */
  view: OperatorView;
  /** The names/roles of all operators (without their view data) */
  crew: Array<{
    playerName: string;
    role: OperatorRole;
    roleLabel: string;
  }>;
}

// ─── Puzzle Database ────────────────────────────────────────────────

/**
 * Hardcoded master puzzle bank.
 * Each puzzle defines a subtle mismatch across the 3 operator views
 * that players must identify through verbal communication.
 */
export const PUZZLE_DATABASE: readonly MasterPuzzle[] = [
  // ── Puzzle 1: Data Type Mismatch ────────────────────────────────
  {
    id: "PZL-001",
    title: "Data Type Mismatch",
    category: "data-type",
    sharedAlert: "Critical: Calibration Core Rejected Transaction",
    views: {
      operator_1: [
        { lineNumber: 1, content: "// CalibrationModule.initialize()", indent: 0, isMismatchLine: false },
        { lineNumber: 2, content: "const calibrationFactor = 5.0;", indent: 0, isMismatchLine: true },
        { lineNumber: 3, content: "const threshold = 0.001;", indent: 0, isMismatchLine: false },
        { lineNumber: 4, content: "", indent: 0, isMismatchLine: false },
        { lineNumber: 5, content: "function applyCalibration(input: number) {", indent: 0, isMismatchLine: false },
        { lineNumber: 6, content: "return input * calibrationFactor;", indent: 2, isMismatchLine: false },
        { lineNumber: 7, content: "}", indent: 0, isMismatchLine: false },
        { lineNumber: 8, content: "", indent: 0, isMismatchLine: false },
        { lineNumber: 9, content: "module.export(applyCalibration);", indent: 0, isMismatchLine: false },
      ],
      operator_2: [
        { lineNumber: 1, content: "// TransactionValidator.verify()", indent: 0, isMismatchLine: false },
        { lineNumber: 2, content: "function validateInput(value: unknown) {", indent: 0, isMismatchLine: false },
        { lineNumber: 3, content: "if (typeof value !== 'number') return false;", indent: 2, isMismatchLine: false },
        { lineNumber: 4, content: "", indent: 0, isMismatchLine: false },
        { lineNumber: 5, content: "// Strict integer check for core input", indent: 2, isMismatchLine: false },
        { lineNumber: 6, content: "return value === 5;", indent: 2, isMismatchLine: true },
        { lineNumber: 7, content: "}", indent: 0, isMismatchLine: false },
        { lineNumber: 8, content: "", indent: 0, isMismatchLine: false },
        { lineNumber: 9, content: "module.export(validateInput);", indent: 0, isMismatchLine: false },
      ],
      operator_3: [
        { lineNumber: 1, content: "[2026-07-01 11:42:03.771] CALIBRATION_CORE", indent: 0, isMismatchLine: false },
        { lineNumber: 2, content: "├─ status: TRANSACTION_REJECTED", indent: 0, isMismatchLine: false },
        { lineNumber: 3, content: "├─ module: CalibrationModule", indent: 0, isMismatchLine: false },
        { lineNumber: 4, content: "├─ input_type: Float Primitive", indent: 0, isMismatchLine: true },
        { lineNumber: 5, content: "├─ expected_type: Integer Primitive", indent: 0, isMismatchLine: false },
        { lineNumber: 6, content: "├─ value_received: 5.0", indent: 0, isMismatchLine: false },
        { lineNumber: 7, content: "├─ validator: TransactionValidator", indent: 0, isMismatchLine: false },
        { lineNumber: 8, content: "├─ strict_mode: enabled", indent: 0, isMismatchLine: false },
        { lineNumber: 9, content: "└─ recommendation: ALIGN_DATA_TYPES", indent: 0, isMismatchLine: false },
      ],
    },
  },

  // ── Puzzle 2: Case-Sensitivity Mismatch ─────────────────────────
  {
    id: "PZL-002",
    title: "Case-Sensitivity Mismatch",
    category: "case-sensitivity",
    sharedAlert: "Warning: Identity Resolution Failed — Operator Key Mismatch",
    views: {
      operator_1: [
        { lineNumber: 1, content: "// AuthService.resolveIdentity()", indent: 0, isMismatchLine: false },
        { lineNumber: 2, content: "interface SessionPayload {", indent: 0, isMismatchLine: false },
        { lineNumber: 3, content: "userId: string;", indent: 2, isMismatchLine: true },
        { lineNumber: 4, content: "timestamp: number;", indent: 2, isMismatchLine: false },
        { lineNumber: 5, content: "permissions: string[];", indent: 2, isMismatchLine: false },
        { lineNumber: 6, content: "}", indent: 0, isMismatchLine: false },
        { lineNumber: 7, content: "", indent: 0, isMismatchLine: false },
        { lineNumber: 8, content: "const session = auth.createSession({", indent: 0, isMismatchLine: false },
        { lineNumber: 9, content: "userId: operatorToken.sub,", indent: 2, isMismatchLine: true },
        { lineNumber: 10, content: "});", indent: 0, isMismatchLine: false },
      ],
      operator_2: [
        { lineNumber: 1, content: "// DatabaseAdapter.queryOperator()", indent: 0, isMismatchLine: false },
        { lineNumber: 2, content: "SELECT * FROM operators", indent: 0, isMismatchLine: false },
        { lineNumber: 3, content: "WHERE user_id = $1", indent: 2, isMismatchLine: true },
        { lineNumber: 4, content: "AND active = true", indent: 2, isMismatchLine: false },
        { lineNumber: 5, content: "LIMIT 1;", indent: 2, isMismatchLine: false },
        { lineNumber: 6, content: "", indent: 0, isMismatchLine: false },
        { lineNumber: 7, content: "-- Column mapping:", indent: 0, isMismatchLine: false },
        { lineNumber: 8, content: "-- user_id  → VARCHAR(36) NOT NULL", indent: 0, isMismatchLine: true },
        { lineNumber: 9, content: "-- active   → BOOLEAN DEFAULT true", indent: 0, isMismatchLine: false },
        { lineNumber: 10, content: "-- role     → VARCHAR(24)", indent: 0, isMismatchLine: false },
      ],
      operator_3: [
        { lineNumber: 1, content: "[2026-07-01 11:42:07.339] IDENTITY_SERVICE", indent: 0, isMismatchLine: false },
        { lineNumber: 2, content: "├─ status: RESOLUTION_FAILED", indent: 0, isMismatchLine: false },
        { lineNumber: 3, content: "├─ lookup_key: UserID", indent: 0, isMismatchLine: true },
        { lineNumber: 4, content: "├─ source: AuthService → SessionPayload", indent: 0, isMismatchLine: false },
        { lineNumber: 5, content: "├─ target: DatabaseAdapter → operators", indent: 0, isMismatchLine: false },
        { lineNumber: 6, content: "├─ key_comparison:", indent: 0, isMismatchLine: false },
        { lineNumber: 7, content: "│  ├─ source_key: userId (camelCase)", indent: 0, isMismatchLine: false },
        { lineNumber: 8, content: "│  ├─ target_key: user_id (snake_case)", indent: 0, isMismatchLine: false },
        { lineNumber: 9, content: "│  └─ log_key: UserID (PascalCase)", indent: 0, isMismatchLine: true },
        { lineNumber: 10, content: "└─ recommendation: NORMALIZE_KEY_CASING", indent: 0, isMismatchLine: false },
      ],
    },
  },
] as const;
