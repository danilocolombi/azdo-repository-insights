export function formatBranchFriendlyName(branchName: string): string {
  let branchFriendlyName = branchName;

  if (branchName.startsWith("refs/heads/")) {
    branchFriendlyName = branchName.substring("refs/heads/".length);
  }

  return branchFriendlyName;
}