import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import shell from 'shelljs';

import { 
    AnalysisResult,
    CommitInfo,
    ContributorStats,
    RepositorySummary
 } from './types';

export class RepositoryAnalyzer {
  private repoPath: string;
  private username: string;
  private repoName: string;
  private startTime: number = 0;

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
  
    // HTTPS format: https://github.com/username/repo.git or repo with dots
    match = url.match(/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/);
    
    if (!match) {
      // SSH format: git@github.com:username/repo.git or repo with dots
      match = url.match(/github\.com[:\/]([^\/]+)\/([^\/]+?)(\.git)?$/);
    }
  
    if (!match) {
      throw new Error(`Unable to parse GitHub URL: ${url}`);
    }
  
    return {
      username: match[1],
      repoName: match[2]
    };
  }
  
  private get repoIdentifier(): string {
    return chalk.cyan(`${this.username}/${this.repoName}`);
  }

  private log(message: string): void {
    console.log(`${chalk.gray('→')} ${message}`);
  }

  private success(message: string): void {
    console.log(`${chalk.green('✓')} ${message}`);
  }

  private warn(message: string): void {
    console.log(`${chalk.yellow('⚠')} ${message}`);
  }

  private error(message: string): void {
    console.error(`${chalk.red('✗')} ${message}`);
  }

  private getDuration(): string {
    const duration = Date.now() - this.startTime;
    return chalk.gray(`(${duration}ms)`);
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

      const totalAdditions = contributors.reduce((sum, c) => sum + c.additions, 0);
      const totalDeletions = contributors.reduce((sum, c) => sum + c.deletions, 0);

      this.success(
        `${this.repoIdentifier}: Analysis complete ${this.getDuration()}\n` +
        `   ${chalk.bold(commits.length)} commits, ` +
        `${chalk.bold(contributors.length)} contributors\n` +
        `   ${chalk.green(`+${totalAdditions}`)} ` +
        `${chalk.red(`-${totalDeletions}`)} lines of code\n` +
        `   First commit: ${chalk.gray(commits[commits.length - 1]?.date || 'N/A')}\n` +
        `   Latest commit: ${chalk.gray(commits[0]?.date || 'N/A')}`
      );


      return {
        summary,
        contributors,
        recentCommits: commits.slice(0, 10),
        repositoryPath: this.repoPath
      };
    } catch (error) {
      this.error(`${this.repoIdentifier}: Analysis failed`);
      this.cleanup();
      throw error;
    }
  }

  private isValidGitRepo(path: string): boolean {
    return fs.existsSync(path) && fs.existsSync(`${path}/.git`);
  }

  private getCurrentRemoteUrl(): string {
    const result = shell.exec('git remote get-url origin', { silent: true });
    return result.code === 0 ? result.stdout.trim() : '';
  }

  private normalizeGitUrl(url: string): string {
    // Remove .git suffix and normalize to HTTPS format
    return url
      .trim()
      .replace(/\.git$/, '')
      .replace('git@github.com:', 'https://github.com/');
  }

  private async cloneRepo(): Promise<void> {
    shell.mkdir('-p', path.dirname(this.repoPath));

    if (this.isValidGitRepo(this.repoPath)) {
      shell.cd(this.repoPath);
      const currentUrl = this.getCurrentRemoteUrl();
      const expectedUrl = this.repoUrl;

      if (this.normalizeGitUrl(currentUrl) === this.normalizeGitUrl(expectedUrl)) {
        this.log(`${this.repoIdentifier}: Updating existing repository...`);

        const fetchResult = shell.exec('git fetch --all --tags', { silent: true });
        if (fetchResult.code !== 0) {
          throw new Error(`Failed to fetch updates: ${fetchResult.stderr}`);
        }

        // More robust default branch detection
        const branchResult = shell.exec('git remote show origin | grep "HEAD branch" | cut -d: -f2', { silent: true });
        let defaultBranch = branchResult.stdout.trim();
        
        // Validate the branch name - only allow valid git branch characters
        if (!defaultBranch || !/^[a-zA-Z0-9_.-]+$/.test(defaultBranch)) {
          // Try to detect branch directly from refs
          const refsResult = shell.exec('git symbolic-ref refs/remotes/origin/HEAD', { silent: true });
          if (refsResult.code === 0) {
            defaultBranch = refsResult.stdout.trim().replace('refs/remotes/origin/', '');
          } else {
            // Fallback to common branch names
            const branches = ['main', 'master'];
            for (const branch of branches) {
              const checkBranch = shell.exec(`git rev-parse --verify origin/${branch}`, { silent: true });
              if (checkBranch.code === 0) {
                defaultBranch = branch;
                break;
              }
            }
          }
        }

        // If we still don't have a valid branch, throw an error
        if (!defaultBranch || !/^[a-zA-Z0-9_.-]+$/.test(defaultBranch)) {
          throw new Error(`Could not determine default branch for ${this.repoIdentifier}`);
        }

        this.log(`${this.repoIdentifier}: Resetting to ${chalk.blue(defaultBranch)}...`);
        
        const resetResult = shell.exec(`git reset --hard origin/${defaultBranch}`, { silent: true });
        if (resetResult.code !== 0) {
          throw new Error(`Failed to reset to origin/${defaultBranch}: ${resetResult.stderr}`);
        }

        const cleanResult = shell.exec('git clean -fd', { silent: true });
        if (cleanResult.code !== 0) {
          throw new Error(`Failed to clean repository: ${cleanResult.stderr}`);
        }

        this.success(`${this.repoIdentifier}: Repository updated ${this.getDuration()}`);
      } else {
        this.warn(`${this.repoIdentifier}: Remote URL differs, recloning...`);
        shell.rm('-rf', this.repoPath);
        await this.performFreshClone();
      }
    } else {
      await this.performFreshClone();
    }
  }
  
  private async performFreshClone(): Promise<void> {
    this.log(`${this.repoIdentifier}: Cloning repository...`);
    const cloneStart = Date.now();
    
    const result = shell.exec(
      `git clone ${this.repoUrl} ${this.repoPath}`,
      { silent: true }
    );

    if (result.code !== 0) {
      throw new Error(`Failed to clone repository: ${result.stderr}`);
    }

    shell.cd(this.repoPath);
    this.success(`${this.repoIdentifier}: Clone complete ${chalk.gray(`(${Date.now() - cloneStart}ms)`)}`);
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
