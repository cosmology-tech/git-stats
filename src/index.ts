// @ts-nocheck
import * as path from 'path';
import shell from 'shelljs';

interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface ContributorStats {
  name: string;
  email: string;
  commits: number;
  additions: number;
  deletions: number;
  firstCommit: string;
  lastCommit: string;
}

interface RepositorySummary {
  totalCommits: number;
  totalContributors: number;
  firstCommit: string;
  lastCommit: string;
}

interface AnalysisResult {
  summary: RepositorySummary;
  contributors: ContributorStats[];
  recentCommits: CommitInfo[];
  repositoryPath: string;
}

class GitRepoAnalyzer {
  private repoPath: string;
  private username: string;
  private repoName: string;

  constructor(private repoUrl: string, private tempDir: string = 'temp') {
    // Parse username and repo name from URL
    const urlParts = this.parseGitUrl(repoUrl);
    this.username = urlParts.username;
    this.repoName = urlParts.repoName;

    // Construct path: <tempDir>/<username>/<repoName>
    this.repoPath = path.join(
      process.cwd(),
      this.tempDir,
      this.username,
      this.repoName
    );

    if (!shell.which('git')) {
      throw new Error('Git is required but not installed.');
    }
  }

  private parseGitUrl(url: string): { username: string; repoName: string } {
    // Handle different Git URL formats
    let match;

    // HTTPS format: https://github.com/username/repo.git
    match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)(\.git)?$/);
    
    if (!match) {
      // SSH format: git@github.com:username/repo.git
      match = url.match(/([^:]+)\/([^\/\.]+)(\.git)?$/);
    }

    if (!match) {
      throw new Error(`Unable to parse GitHub URL: ${url}`);
    }

    return {
      username: match[1],
      repoName: match[2]
    };
  }

  public async cloneAndAnalyze(): Promise<AnalysisResult> {
    try {
      await this.cloneRepo();
      const contributors = await this.analyzeContributors();
      const commits = await this.getCommitHistory();
      
      const summary: RepositorySummary = {
        totalCommits: commits.length,
        totalContributors: contributors.length,
        firstCommit: commits[commits.length - 1]?.date || '',
        lastCommit: commits[0]?.date || ''
      };

      return {
        summary,
        contributors,
        recentCommits: commits.slice(0, 10),
        repositoryPath: this.repoPath
      };
    } catch (error) {
      console.error('Analysis failed:', error);
      this.cleanup();
      throw error;
    }
  }

  private async cloneRepo(): Promise<void> {
    // Create nested directory structure
    shell.mkdir('-p', path.dirname(this.repoPath));
    
    // Remove existing repo if it exists
    shell.rm('-rf', this.repoPath);

    // Clone the repository
    const result = shell.exec(
      `git clone ${this.repoUrl} ${this.repoPath}`,
      { silent: true }
    );
    
    if (result.code !== 0) {
      throw new Error(`Failed to clone repository: ${result.stderr}`);
    }

    shell.cd(this.repoPath);
  }

  private async analyzeContributors(): Promise<ContributorStats[]> {
    const shortlog = shell.exec(
      'git shortlog -sne --all', 
      { silent: true }
    ).stdout;

    const contributors: Map<string, ContributorStats> = new Map();

    shortlog.split('\n').forEach(line => {
      const match = line.trim().match(/^\s*(\d+)\s+(.+?)\s+<(.+)>$/);
      if (match) {
        const [_, commits, name, email] = match;
        contributors.set(email, {
          name,
          email,
          commits: parseInt(commits),
          additions: 0,
          deletions: 0,
          firstCommit: '',
          lastCommit: ''
        });
      }
    });

    for (const [email, stats] of contributors) {
      const authorLog = shell.exec(
        `git log --author="${email}" --pretty=format:"%ad" --date=short --reverse`,
        { silent: true }
      ).stdout.split('\n');

      if (authorLog.length > 0) {
        stats.firstCommit = authorLog[0];
        stats.lastCommit = authorLog[authorLog.length - 1];
      }

      const authorStats = shell.exec(
        `git log --author="${email}" --shortstat --pretty=format:""`,
        { silent: true }
      ).stdout;

      const additions = authorStats.match(/(\d+) insertion/g)?.map(n => parseInt(n)) || [];
      const deletions = authorStats.match(/(\d+) deletion/g)?.map(n => parseInt(n)) || [];
      
      stats.additions = additions.reduce((a, b) => a + b, 0);
      stats.deletions = deletions.reduce((a, b) => a + b, 0);
    }

    return Array.from(contributors.values())
      .sort((a, b) => b.commits - a.commits);
  }

  private async getCommitHistory(): Promise<CommitInfo[]> {
    const logFormat = '%H|%an|%ad|%s';
    const log = shell.exec(
      `git log --pretty=format:"${logFormat}" --date=short`,
      { silent: true }
    ).stdout;

    return log.split('\n').map(line => {
      const [hash, author, date, message] = line.split('|');
      return { hash, author, date, message };
    });
  }

  private cleanup(): void {
    shell.rm('-rf', this.repoPath);
  }

  // Utility method to get repository location info
  public getRepositoryInfo() {
    return {
      username: this.username,
      repoName: this.repoName,
      fullPath: this.repoPath
    };
  }
}

// Helper function to print analysis results
function printAnalysisResults(results: AnalysisResult): void {
  console.log('\n=== Repository Analysis Results ===\n');
  
  console.log('Repository Location:', results.repositoryPath);
  
  console.log('\nRepository Summary:');
  console.log(JSON.stringify(results.summary, null, 2));

  console.log('\nTop Contributors:');
  console.log(JSON.stringify(results.contributors.slice(0, 10), null, 2));

  console.log('\nRecent Commits:');
  console.log(JSON.stringify(results.recentCommits, null, 2));
}

// Example usage
async function main() {
  try {
    const analyzer = new GitRepoAnalyzer(
      'https://github.com/cosmology-tech/telescope.git',
      'temp'
    );
    
    // Can check repository info before analysis
    const repoInfo = analyzer.getRepositoryInfo();
    console.log('Will clone to:', repoInfo.fullPath);
    
    const results = await analyzer.cloneAndAnalyze();
    printAnalysisResults(results);

  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

// Run the analysis if called directly
if (require.main === module) {
  main();
}

export { AnalysisResult, CommitInfo, ContributorStats, GitRepoAnalyzer };