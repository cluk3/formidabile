/** The database the host's API and the demo seed use: `DATABASE_URL`, else the docker-compose.yml service. */
export const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://formidabile:formidabile@localhost:5432/formidabile";
