import pandas as pd

# Load the dataset
file_path = 'physionet.org/files/mietic/1.0.0/MIETIC-validate-samples.csv'
df = pd.read_csv(file_path, encoding='utf-8-sig')

# Show column names
print('Columns:')
print(df.columns.tolist())

# Show the first 5 rows
print('\nSample rows:')
print(df.head())

# Show info about the dataframe
print('\nDataFrame info:')
df.info()
