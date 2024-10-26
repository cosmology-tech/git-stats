import shell from 'shelljs';

import { RepositoryAnalyzer } from './analyzer';
import { AnalysisResult } from './types';

export class MultiRepoAnalyzer {
    private analyzers: RepositoryAnalyzer[];
    
    constructor(repoUrls: string[], tempDir: string = 'temp') {
      this.analyzers = repoUrls.map(url => new RepositoryAnalyzer(url, tempDir));
    }
  
    async analyzeAll(): Promise<AnalysisResult[]> {
      const results: AnalysisResult[] = [];
      const originalCwd = process.cwd();
      
      for (const analyzer of this.analyzers) {
        try {
          const result = await analyzer.cloneAndAnalyze();
          results.push(result);
        } catch (error) {
          console.error(`Failed to analyze repository: ${analyzer.getRepositoryInfo().fullPath}`);
          console.error(error);
        } finally {
          // Restore original working directory after each analysis
          shell.cd(originalCwd);
        }
      }
  
      return results;
    }
  
    async analyzeAllParallel(concurrency: number = 3): Promise<AnalysisResult[]> {
      const results: AnalysisResult[] = [];
      const chunks: RepositoryAnalyzer[][] = [];
      const originalCwd = process.cwd();
      
      // Split analyzers into chunks based on concurrency
      for (let i = 0; i < this.analyzers.length; i += concurrency) {
        chunks.push(this.analyzers.slice(i, i + concurrency));
      }
  
      // Process chunks sequentially, but repositories within chunks in parallel
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(async (analyzer) => {
            try {
              const result = await analyzer.cloneAndAnalyze();
              shell.cd(originalCwd); // Restore after each parallel analysis
              return result;
            } catch (error) {
              console.error(`Failed to analyze repository: ${analyzer.getRepositoryInfo().fullPath}`);
              console.error(error);
              shell.cd(originalCwd); // Ensure we restore even on error
              return null;
            }
          })
        );
  
        results.push(...chunkResults.filter((result): result is AnalysisResult => result !== null));
      }
  
      return results;
    }
  
    getRepositoriesInfo() {
      return this.analyzers.map(analyzer => analyzer.getRepositoryInfo());
    }
  }