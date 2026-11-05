FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/VibeTime.Api/VibeTime.Api.csproj backend/VibeTime.Api/
RUN dotnet restore backend/VibeTime.Api/VibeTime.Api.csproj
COPY backend/VibeTime.Api/ backend/VibeTime.Api/
COPY database/ database/
RUN dotnet publish backend/VibeTime.Api/VibeTime.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
RUN mkdir -p /home/app/.aspnet/DataProtection-Keys \
    && chown -R app:app /home/app/.aspnet
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "VibeTime.Api.dll"]
