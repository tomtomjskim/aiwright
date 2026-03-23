# Evidence Collection

## Methodology

### Before/After Comparison
1. **Control** (Before): Run standard tasks WITHOUT aiwright Recipe applied
2. **Treatment** (After): Run same tasks WITH aiwright Recipe applied
3. **Compare**: Pass rate, consistency, token efficiency

### Metrics
| Metric | Definition | Target |
|--------|-----------|--------|
| Pass Rate | % of assertions passed per task | +20%p improvement |
| Consistency | Cosine similarity across 3 runs | +10%p improvement |
| Setup Time | Time from zero to first AI request | 10x reduction |
| PCR | quality / (tokens * turns) | Higher is better |

### Running Benchmarks
```bash
# Benchmark a recipe
aiwright bench default --cases bench/standard-tasks.yaml --save

# View score history
aiwright score default --trend
```

### Evidence Files
- `standard-tasks.yaml` — 10 standard coding tasks
- `control-data.yaml` — Before (no aiwright) results
- `treatment-data.yaml` — After (with aiwright) results
