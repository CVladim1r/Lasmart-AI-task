using Npgsql;
using VibeTime.Api.Services;

namespace VibeTime.Api.Data;

public sealed class DatabaseInitializer(
    IConfiguration configuration,
    IPasswordHasher passwordHasher,
    ILogger<DatabaseInitializer> logger)
{
    public async Task InitializeAsync(CancellationToken cancellationToken)
    {
        var connectionString = configuration.GetConnectionString("Employees");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("ConnectionStrings:Employees is required.");

        var schemaPath = Path.Combine(AppContext.BaseDirectory, "Database", "001_schema.sql");
        var schema = await File.ReadAllTextAsync(schemaPath, cancellationToken);
        await using (var connection = new NpgsqlConnection(connectionString))
        {
            await connection.OpenAsync(cancellationToken);
            await using var command = new NpgsqlCommand(schema, connection);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        var email = configuration["Seed:Email"]?.Trim();
        var password = configuration["Seed:Password"];
        var firstName = configuration["Seed:FirstName"]?.Trim() ?? "Первый";
        var lastName = configuration["Seed:LastName"]?.Trim() ?? "Сотрудник";
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password) ||
            string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
        {
            logger.LogInformation("Initial employee seed is not configured; no seed user was created.");
            return;
        }
        var seedRequest = new VibeTime.Api.Models.CreateEmployeeRequest(lastName, firstName, null, email, password, password);
        var seedErrors = VibeTime.Api.Services.EmployeeValidation.Validate(seedRequest);
        if (seedErrors.Count > 0)
            throw new InvalidOperationException($"Initial employee configuration is invalid: {string.Join("; ", seedErrors.SelectMany(item => item.Value))}");

        await using var seedConnection = new NpgsqlConnection(connectionString);
        await seedConnection.OpenAsync(cancellationToken);
        await using var transaction = await seedConnection.BeginTransactionAsync(cancellationToken);
        await using var marker = new NpgsqlCommand("INSERT INTO application_state (key, value) VALUES ('initial_employee_seed_v1', @email) ON CONFLICT (key) DO NOTHING RETURNING key", seedConnection, transaction);
        marker.Parameters.AddWithValue("email", email);
        var markerInserted = await marker.ExecuteScalarAsync(cancellationToken);
        if (markerInserted is null)
        {
            await transaction.RollbackAsync(cancellationToken);
            logger.LogInformation("Initial employee bootstrap has already been applied; configured seed values were ignored.");
            return;
        }

        await using var seed = new NpgsqlCommand("INSERT INTO employees (last_name, first_name, email, password_hash) VALUES (@last, @first, @email, @hash) ON CONFLICT DO NOTHING", seedConnection, transaction);
        seed.Parameters.AddWithValue("last", lastName);
        seed.Parameters.AddWithValue("first", firstName);
        seed.Parameters.AddWithValue("email", email);
        seed.Parameters.AddWithValue("hash", passwordHasher.Hash(password));
        var inserted = await seed.ExecuteNonQueryAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        logger.LogInformation(inserted == 1
            ? "Initial employee {Email} created from configuration."
            : "Initial employee {Email} already exists; its password was left unchanged.", email);
    }
}
