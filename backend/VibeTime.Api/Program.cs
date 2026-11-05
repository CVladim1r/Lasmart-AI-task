using Microsoft.AspNetCore.Authentication;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
var connectionString = builder.Configuration.GetConnectionString("Employees");
builder.Services.AddSingleton<VibeTime.Api.Data.IEmployeeRepository>(new VibeTime.Api.Data.EmployeeRepository(connectionString ?? string.Empty));
builder.Services.AddScoped<VibeTime.Api.Services.EmployeeService>();
builder.Services.AddSingleton<VibeTime.Api.Services.IPasswordHasher, VibeTime.Api.Services.BcryptSha256PasswordHasher>();
builder.Services.AddSingleton<VibeTime.Api.Data.DatabaseInitializer>();
builder.Services.AddAuthentication(Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "vibetime.session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = Microsoft.AspNetCore.Http.SameSiteMode.Strict;
        options.Cookie.SecurePolicy = Microsoft.AspNetCore.Http.CookieSecurePolicy.SameAsRequest;
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
        options.Events.OnValidatePrincipal = async context =>
        {
            var idClaim = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var repository = context.HttpContext.RequestServices.GetRequiredService<VibeTime.Api.Data.IEmployeeRepository>();
            if (!Guid.TryParse(idClaim, out var id) || await repository.FindByIdAsync(id, context.HttpContext.RequestAborted) is null)
            {
                context.RejectPrincipal();
                await context.HttpContext.SignOutAsync(Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationDefaults.AuthenticationScheme);
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:4200"])
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();
app.UseCors();
app.Use(async (context, next) =>
{
    var isApiMutation = context.Request.Path.StartsWithSegments("/api") &&
        (HttpMethods.IsPost(context.Request.Method) || HttpMethods.IsPut(context.Request.Method) ||
         HttpMethods.IsDelete(context.Request.Method) || HttpMethods.IsPatch(context.Request.Method));
    if (isApiMutation)
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:4200"];
        var origin = context.Request.Headers.Origin.ToString();
        var sameHost = Uri.TryCreate(origin, UriKind.Absolute, out var parsedOrigin) &&
            string.Equals(parsedOrigin.Authority, context.Request.Host.Value, StringComparison.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(origin) || (!sameHost && !allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)) ||
            context.Request.Headers["X-Requested-With"] != "XMLHttpRequest")
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { code = "csrf_validation_failed", message = "Запрос не прошёл проверку источника." });
            return;
        }
    }
    await next();
});
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
await using (var scope = app.Services.CreateAsyncScope())
    await scope.ServiceProvider.GetRequiredService<VibeTime.Api.Data.DatabaseInitializer>().InitializeAsync(CancellationToken.None);
app.Run();
