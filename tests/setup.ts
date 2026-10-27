// Test luôn chạy trên database riêng và ở chế độ demo, không có key thật.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/realtor_test";
process.env.DEMO_MODE = "true";
process.env.ANTHROPIC_API_KEY = "";
process.env.FUB_API_KEY = "";
