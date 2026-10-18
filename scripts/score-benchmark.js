import { readReviewedDataset, scoreReviewedCases } from '../src/benchmark.js';
const file=process.argv[2];
if(!file){
  console.error('Usage: node scripts/score-benchmark.js <reviewed-labels.json>');
  process.exitCode=2;
} else {
  try{
    const dataset=await readReviewedDataset(file);
    const result=scoreReviewedCases(dataset.cases);
    console.log(JSON.stringify(result,null,2));
    if (!result.sources.includes('reviewed-staging')) {
      console.error('Note: synthetic-only benchmark cannot establish real-site precision.');
    }
  }catch(error){console.error('Benchmark error: '+error.message);process.exitCode=2;}
}
