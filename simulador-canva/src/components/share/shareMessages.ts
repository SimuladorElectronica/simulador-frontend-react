/** Mensaje informativo del bloque "Compartir proyecto" según el contexto. */
export function buildInfoMessage(
    currentProject: { shareSlug: string } | null,
    activeTemplate: { title: string } | null,
    isLoggedIn: boolean,
): string {
    if (currentProject) return projectMessage(currentProject, isLoggedIn);
    if (activeTemplate) return templateMessage(activeTemplate, isLoggedIn);
    return isLoggedIn
        ? 'Se creará un proyecto nuevo en tu cuenta.'
        : 'Sin sesión: se guardará como proyecto anónimo (solo lectura).';
}

function projectMessage(project: { shareSlug: string }, isLoggedIn: boolean): string {
    return isLoggedIn
        ? `Se actualizará el proyecto guardado (slug ${project.shareSlug}) en tu cuenta.`
        : `Proyecto recordado (slug ${project.shareSlug}). Iniciá sesión para poder editarlo; si no, se creará una copia nueva.`;
}

function templateMessage(template: { title: string }, isLoggedIn: boolean): string {
    return isLoggedIn
        ? `Copia de la plantilla "${template.title}": al guardar se crea un proyecto NUEVO en tu cuenta. La plantilla nunca se modifica.`
        : `Copia de la plantilla "${template.title}": sin sesión se guardará como proyecto anónimo (solo lectura). Iniciá sesión para guardarla como proyecto propio.`;
}
