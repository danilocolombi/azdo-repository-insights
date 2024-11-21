import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { Page } from "azure-devops-ui/Page";
import {
  CustomHeader,
  HeaderDescription,
  HeaderTitle,
  HeaderTitleArea,
  HeaderTitleRow,
  TitleSize,
} from "azure-devops-ui/Header";
import { getClient } from "azure-devops-extension-api";
import { GitRestClient } from "azure-devops-extension-api/Git/GitClient";
import {
  GitCommitRef,
  GitQueryCommitsCriteria,
  GitRepository,
  GitVersionOptions,
  GitVersionType,
} from "azure-devops-extension-api/Git/Git";
import { formatBranchFriendlyName } from "../../utils";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "azure-devops-ui/Card";

interface ContributorState {
  commits: GitCommitRef[];
}

interface ContributorProps {
  repo: GitRepository;
}

interface CommitsByPerson {
  author: string;
  data: ChartData[];
  totalCommits: number;
}

interface ChartData {
  date: string;
  commits: number;
}

export class Contributors extends React.Component<
  ContributorProps,
  ContributorState
> {
  constructor(props: ContributorProps) {
    super(props);
  }

  public componentDidMount() {
    try {
      SDK.init();

      SDK.ready()
        .then(() => {
          this.loadCommitsData();
        })
        .catch((error) => {
          console.error("SDK ready failed: ", error);
        });
    } catch (error) {
      console.error(
        "Error during SDK initialization or project context loading: ",
        error
      );
    }
  }

  public render(): JSX.Element {
    if (!this.state) {
      return <div></div>;
    }

    const { commits } = this.state;
    const { repo } = this.props;

    const branchFriendlyName = formatBranchFriendlyName(repo.defaultBranch);
    const commitsByMonth = this.organizeCommitsByMonth(commits);
    const commitsChartData = Array.from(commitsByMonth.entries())
      .reverse()
      .map(([date, commits]) => ({
        date: date,
        commits: commits.length,
      }));

    const commitsByPerson = new Map<string, GitCommitRef[]>();

    commits.forEach((commit) => {
      const author = commit.author.email;
      const commits = commitsByPerson.get(author) || [];
      commitsByPerson.set(author, [...commits, commit]);
    });

    const commitsByPersonChartData: CommitsByPerson[] = [];

    commitsByPerson.forEach((commits, author) => {
      const commitsByMonth = this.organizeCommitsByMonth(commits);
      const data = Array.from(commitsByMonth.entries())
        .reverse()
        .map(([date, commits]) => ({
          date: date,
          commits: commits.length,
        }));
      commitsByPersonChartData.push({
        author,
        data,
        totalCommits: commits.length,
      });
    });

    commitsByPersonChartData.sort((a, b) => b.totalCommits - a.totalCommits);

    return (
      <Page className="sample-page width-100">
        <CustomHeader className="bolt-header-with-commandbar">
          <HeaderTitleArea>
            <HeaderTitleRow>
              <HeaderTitle
                ariaLevel={3}
                className="text-ellipsis"
                titleSize={TitleSize.Large}
              >
                Contributors
              </HeaderTitle>
            </HeaderTitleRow>
            <HeaderDescription>
              Contributions per month to {branchFriendlyName}
            </HeaderDescription>
          </HeaderTitleArea>
        </CustomHeader>
        <div className="bolt-page-content">
          <div className="flex-row flex-grow justify-content-center padding-16 text-center">
            <Card
              className="flex-grow"
              titleProps={{ text: "Commits over time" }}
            >
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart
                  data={commitsChartData}
                  margin={{
                    top: 10,
                    right: 30,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="commits"
                    stroke="#8884d8"
                    fill="#8884d8"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
          <div className="chart-row">
            {commitsByPersonChartData.map(({ author, data, totalCommits }) => (
              <div className="chart-column" key={author}>
                <Card
                  titleProps={{ text: `${author} - ${totalCommits} commit(s)` }}
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart
                      data={data}
                      margin={{
                        top: 10,
                        right: 30,
                        left: 0,
                        bottom: 0,
                      }}
                    >
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="commits"
                        stroke="#8884d8"
                        fill="#8884d8"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </Page>
    );
  }

  private async loadCommitsData(): Promise<void> {
    try {
      const { repo } = this.props;

      const gitClient = getClient(GitRestClient);

      const commits = await gitClient.getCommits(repo.id, {
        $top: 1000,
        itemVersion: {
          versionType: GitVersionType.Branch,
          version: formatBranchFriendlyName(repo.defaultBranch),
          versionOptions: GitVersionOptions.None,
        },
      } as GitQueryCommitsCriteria);

      this.setState({
        commits,
      });

      SDK.notifyLoadSucceeded();
    } catch (error) {
      console.error("Failed to load project context: ", error);
    }
  }

  private organizeCommitsByMonth(
    commits: GitCommitRef[]
  ): Map<string, GitCommitRef[]> {
    const commitsByMonth: Map<string, GitCommitRef[]> = new Map();

    commits.forEach((commit) => {
      const formattedDate = commit.committer.date.toLocaleDateString(
        undefined,
        {
          month: "short",
          year: "numeric",
        }
      );

      commitsByMonth.set(
        formattedDate,
        (commitsByMonth.get(formattedDate) || []).concat(commit)
      );
    });

    return commitsByMonth;
  }
}
