# Contributing to Open TMS

Thank you for your interest in contributing to Open TMS! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

### Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** for your changes
4. **Make your changes** and test them
5. **Submit a pull request** with a clear description

### Detailed Steps

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/open_tms.git
cd open_tms

# 2. Add the upstream repository
git remote add upstream https://github.com/DominicFinn/open_tms.git

# 3. Create a feature branch
git checkout -b feature/your-feature-name

# 4. Install dependencies
npm install

# 5. Start development servers
npm run dev

# 6. Make your changes and test them
# ... your changes ...

# 7. Commit your changes
git add .
git commit -m "Add: descriptive commit message"

# 8. Push to your fork
git push origin feature/your-feature-name

# 9. Create a Pull Request on GitHub
```

## 🎯 Types of Contributions

### 🐛 Bug Reports
- Use the [GitHub Issues](https://github.com/DominicFinn/open_tms/issues) template
- Include steps to reproduce the bug
- Provide expected vs actual behavior
- Include system information (OS, browser, etc.)

### ✨ Feature Requests
- Start a [GitHub Discussion](https://github.com/DominicFinn/open_tms/discussions) for major features
- Use GitHub Issues for smaller enhancements
- Provide clear use cases and benefits
- Consider implementation complexity

### 📝 Documentation
- Fix typos and improve clarity
- Add examples and tutorials
- Update API documentation
- Improve setup and deployment guides

### 🎨 UI/UX Improvements
- Enhance the Material Design 3 implementation
- Improve responsive design
- Add animations and micro-interactions
- Fix accessibility issues

### 🔧 Backend Development
- Add new API endpoints
- Improve performance and scalability
- Add new features and functionality
- Enhance error handling and validation

### 🧪 Testing
- Add unit tests for new features
- Improve test coverage
- Add integration tests
- Set up automated testing

### 📊 Project Management
- Help triage issues
- Review pull requests
- Organize milestones and releases
- Improve project documentation

## 📋 Development Guidelines

### Code Style
- Follow existing code patterns and conventions
- Use TypeScript for type safety
- Write clear, self-documenting code
- Add comments for complex logic

### Commit Messages
- Use clear, descriptive commit messages
- Follow the format: `type: description`
- Examples:
  - `feat: add shipment tracking map`
  - `fix: resolve customer edit validation`
  - `docs: update API documentation`
  - `style: improve button hover states`

### Pull Requests
- Keep PRs focused and atomic
- Include tests for new functionality
- Update documentation as needed
- Provide clear descriptions of changes
- Link related issues

### Testing
- Test your changes thoroughly
- Ensure all existing tests pass
- Add new tests for new features
- Test on different browsers/devices

## 🛠️ Development Setup

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Git
- A code editor (VS Code recommended)

### Local Development
```bash
# Install dependencies
npm install

# Start the database
docker compose up -d db

# Start development servers
npm run dev

# Access the application
# Frontend: http://localhost:5174
# Backend: http://localhost:3001
# API Docs: http://localhost:3001/docs
```

### Project Structure
```
open_tms/
├── backend/          # Fastify API server
├── frontend/         # React application
├── packages/         # Shared TypeScript types
├── terraform/        # Infrastructure as Code
├── .github/          # CI/CD workflows
└── docs/            # Documentation
```

## 🐛 Reporting Issues

### Before Reporting
- Check if the issue already exists
- Try the latest version
- Search existing discussions

### Issue Template
When creating an issue, please include:

1. **Bug Description**: Clear description of the problem
2. **Steps to Reproduce**: Detailed steps to reproduce
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**: OS, browser, Node.js version
6. **Screenshots**: If applicable
7. **Additional Context**: Any other relevant information

## 💬 Getting Help

- **GitHub Discussions**: [Ask questions](https://github.com/DominicFinn/open_tms/discussions)
- **GitHub Issues**: [Report bugs](https://github.com/DominicFinn/open_tms/issues)
- **Documentation**: Check the [README](./README.md) and [deployment guide](./DEPLOYMENT.md)

## 🎉 Recognition

Contributors will be recognized in:
- README acknowledgments
- Release notes
- GitHub contributor graphs
- Project documentation

## 📄 License

By contributing to Open TMS, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

## 🙏 Thank You

Thank you for contributing to Open TMS! Your contributions help make this project better for everyone in the community.

---

**Questions?** Feel free to [start a discussion](https://github.com/DominicFinn/open_tms/discussions) or [open an issue](https://github.com/DominicFinn/open_tms/issues)!
