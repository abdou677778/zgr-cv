<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## CV chronology and multilingual integrity

- Experiences, training and education must remain in reverse chronological order after adds, date edits, imports, reloads and exports. Use the shared chronology helper, never localized text comparison or locale-dependent Date.parse. Ongoing dated items first; then end/start dates descending; stable ties; unrecognized dates last without inventing dates.
- Keep the same immutable row ID across languages. New rows are provisional source-language copies in other versions, explicitly pending translation. Preserve existing target prose on edits and show the updated source per field; never overwrite a manual translation silently.
- Pending changes are persisted and highlighted red only in the editor, never as CV/PDF content. Date order, logos, hidden fields and review state must follow row IDs, not array positions. Deletions require target-language review.
- Test all seven languages, additions, edits from another language, date reordering, missing/ambiguous dates, hidden-field retention, reload and stale AI proposals. Keep both master-prompt copies identical. MCP must reject unsorted or unresolved multilingual JSON before persistence.
