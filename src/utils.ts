export function formatBranchFriendlyName(branchName: string): string {
  let branchFriendlyName = branchName;

  if (branchName.startsWith("refs/heads/")) {
    branchFriendlyName = branchName.substring("refs/heads/".length);
  }

  return branchFriendlyName;
}

export function getOneMonthAgo(): Date {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return oneMonthAgo;
}

export function getOneWeekAgo(): Date {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return oneWeekAgo;
}

export function getOneYearAgo(): Date {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return oneYearAgo;
}

export function isValidDate(date: Date): boolean {
  if (date === undefined || date === null) {
    return false;
  }

  return date instanceof Date;
}