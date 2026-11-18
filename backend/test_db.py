
from sqlalchemy import text
from database import engine

try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT DATABASE()"))
        database_name = result.scalar()

        print("MySQL Connection Successful!")
        print("Connected Database:", database_name)

except Exception as error:
    print("Database Connection Failed!")
    print("Error:", error)
