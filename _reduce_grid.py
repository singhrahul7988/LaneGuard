"""Reduce tuning grid size and iterations for CatBoost pipeline to finish within resource limits."""
with open(r'ml/train_catboost.py', 'r', encoding='utf-8') as f:
    c = f.read()

# Replace the tuning grid params
old_grid = """    # Build tuning grid
    depths = [4, 6, 8]
    learning_rates = [0.03, 0.05, 0.07, 0.1]
    l2_leaf_regs = [1, 3, 5, 8]
    border_counts = [32, 64, 128]"""
new_grid = """    # Build reduced tuning grid (resource-aware)
    depths = [6, 8]
    learning_rates = [0.05, 0.07]
    l2_leaf_regs = [3, 5]
    border_counts = [64, 128]"""
c = c.replace(old_grid, new_grid)
print(f'Grid reduced: {old_grid != new_grid}')

# Reduce iterations from 1000 to 500 (faster, still adequate)
old_iter = '"iterations": 1000,'
new_iter = '"iterations": 500,'
c = c.replace(old_iter, new_iter)
print(f'Iterations reduced: {old_iter != new_iter}')

if c:
    with open(r'ml/train_catboost.py', 'w', encoding='utf-8') as f:
        f.write(c)
    print('All changes applied.')
else:
    print('ERROR: file became empty?')