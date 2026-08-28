import argparse
import sys
import os
import uvicorn

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from src.csv_importer import CSVImporter
from src.daily_syncer import DailySyncer
from src.db_client import MariaDBClient

def main():
    parser = argparse.ArgumentParser(description='PostgreSQL -> MariaDB Data Migration & Sync CLI & Web Tool')
    parser.add_argument('--web', action='store_true', help='Launch Web UI Dashboard')
    parser.add_argument('--port', type=int, default=5050, help='Port for Web UI')
    parser.add_argument('--csv-dry-run', action='store_true', help='Run dry-run processing on CSV file')
    parser.add_argument('--csv-import', action='store_true', help='Execute live CSV import into MariaDB')
    parser.add_argument('--daily-sync-dry-run', action='store_true', help='Test daily incremental sync logic')
    parser.add_argument('--test-db', action='store_true', help='Test connection to MariaDB server')
    parser.add_argument('--csv-path', type=str, default='charging_data.csv', help='Path to CSV file')

    args = parser.parse_args()

    if args.test_db:
        print('=== Testing MariaDB Connection ===')
        client = MariaDBClient()
        conn = client.get_connection()
        if conn:
            print('Status: ONLINE - Connection Successful!')
            conn.close()
        else:
            print('Status: OFFLINE - Access Denied or Host Unreachable')

    elif args.csv_dry_run:
        print('=== Running CSV Dry-Run Transformation ===')
        importer = CSVImporter()
        result = importer.process_csv(args.csv_path, dry_run=True)
        print('Result Summary:', result.get('status', 'unknown').upper())
        if result.get('status') == 'success':
            print('Total Rows:', result.get('total_rows', 0))
            print('Mapped Records:', result.get('mapped_records', 0))
        else:
            print('Message:', result.get('message', 'No details'))

    elif args.csv_import:
        print('=== Executing Live CSV Import ===')
        importer = CSVImporter()
        result = importer.process_csv(args.csv_path, dry_run=False)
        print('Import Result:', result)

    else:
        print(f'=== Launching Responsive Web Dashboard on http://0.0.0.0:{args.port} ===')
        print(f'Local URL: http://localhost:{args.port}')
        print(f'Network URL: http://192.168.0.25:{args.port}')
        uvicorn.run("src.server:app", host="0.0.0.0", port=args.port, reload=True)

if __name__ == '__main__':
    main()
