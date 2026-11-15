export interface InsertFeedback {
    libraryId: string;
    kind: 'inserted' | 'already';
    inserted: string[];
    existing: string[];
}

/** Texto del aviso del pie para la última inserción de headers. */
export function feedbackMessage(feedback: InsertFeedback): string {
    if (feedback.kind === 'inserted') {
        return `✓ Insertado: ${feedback.inserted.map((header) => `<${header}>`).join(', ')}`;
    }
    return `✓ Ya estaba incluido (${feedback.existing.map((header) => `<${header}>`).join(', ')})`;
}
