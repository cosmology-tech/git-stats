# @pyramation/git-stats

Analyze GitHub repositories for contributor and commit statistics.

## Features

- Clone multiple GitHub repositories efficiently
- Analyze contributor statistics and commit history
- Smart repository updates (clone/pull as needed)
- Colorful progress logging
- Save analysis results as JSON with timestamps
- Handle both HTTPS and SSH GitHub URLs
- Support for repositories with various branch configurations

## Installation

```bash
npm install -g @pyramation/git-stats
# or
yarn global add @pyramation/git-stats
```

## Usage

### Basic Usage

```typescript
import { MultiRepoAnalyzer } from '@pyramation/git-stats';

const repos = [
  "https://github.com/username/repo1",
  "https://github.com/username/repo2"
];

async function analyze() {
  const analyzer = new MultiRepoAnalyzer(repos, 'temp');
  const results = await analyzer.analyzeAll();
  console.log(results);
}
```

### Analyze Single Repository

```typescript
import { RepositoryAnalyzer } from '@pyramation/git-stats';

async function analyzeSingle() {
  const analyzer = new RepositoryAnalyzer(
    'https://github.com/username/repo',
    'temp'
  );
  const result = await analyzer.cloneAndAnalyze();
  console.log(result);
}
```

## Output Format

The analysis results include:

```typescript
interface AnalysisResult {
  summary: {
    totalCommits: number;
    totalContributors: number;
    firstCommit: string;
    lastCommit: string;
  };
  contributors: {
    name: string;
    email: string;
    commits: number;
    additions: number;
    deletions: number;
    firstCommit: string;
    lastCommit: string;
  }[];
  recentCommits: {
    hash: string;
    author: string;
    date: string;
    message: string;
  }[];
  repositoryPath: string;
}
```

## Development

1. Clone the repository:
```bash
git clone https://github.com/pyramation/git-stats.git
cd git-stats
```

2. Install dependencies:
```bash
npm install
```

3. Build:
```bash
npm run build
```

4. Run tests:
```bash
npm test
```

