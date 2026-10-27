/** Never activate a waiting worker until the current workspace is persisted. */
export async function applyPwaUpdateAfterSaving(save:()=>Promise<unknown>,activate:()=>boolean){
  await save();
  return activate();
}
