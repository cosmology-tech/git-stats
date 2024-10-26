export interface CommitInfo {
    hash: string;
    author: string;
    date: string;
    message: string;
  }
  
  export interface ContributorStats {
    name: string;
    email: string;
    commits: number;
    additions: number;
    deletions: number;
    firstCommit: string;
    lastCommit: string;
  }
  
  export interface RepositorySummary {
    totalCommits: number;
    totalContributors: number;
    firstCommit: string;
    lastCommit: string;
  }
  
  export interface AnalysisResult {
    summary: RepositorySummary;
    contributors: ContributorStats[];
    recentCommits: CommitInfo[];
    repositoryPath: string;
  }
  