export type ReplanPiece = { start: string; minutes: number };
export type ReplanChange = {
  todoId: number;
  title: string;
  from: string;
  pieces: ReplanPiece[];
  tomorrow: ReplanPiece | null;
};
export type ReplanPreview = {
  confirmationToken: string;
  dayEnd: string;
  changes: ReplanChange[];
};
