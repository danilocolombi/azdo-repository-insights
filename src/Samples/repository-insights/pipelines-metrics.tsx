import * as SDK from "azure-devops-extension-sdk";
import React from "react";

import { Build, BuildRestClient } from "azure-devops-extension-api/Build";
import {
  CommonServiceIds,
  getClient,
  IProjectInfo,
  IProjectPageService,
} from "azure-devops-extension-api";
import { GitRepository } from "azure-devops-extension-api/Git/Git";
import { Card } from "azure-devops-ui/Card";
import {
  ColumnSorting,
  ISimpleTableCell,
  ITableColumn,
  renderSimpleCell,
  SimpleTableCell,
  sortItems,
  SortOrder,
  Table,
} from "azure-devops-ui/Table";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { Page } from "azure-devops-ui/Page";
import {
  CustomHeader,
  HeaderDescription,
  HeaderTitle,
  HeaderTitleArea,
  HeaderTitleRow,
  TitleSize,
} from "azure-devops-ui/Header";
import {
  HeaderCommandBar,
  IHeaderCommandBarItem,
} from "azure-devops-ui/HeaderCommandBar";
import { Duration } from "azure-devops-ui/Duration";
import { Observer } from "azure-devops-ui/Observer";
import { FilterBar } from "azure-devops-ui/FilterBar";
import {
  Filter,
  FILTER_CHANGE_EVENT,
  IFilterState,
} from "azure-devops-ui/Utilities/Filter";
import { KeywordFilterBarItem } from "azure-devops-ui/TextFilterBarItem";
import {
  getOneMonthAgo,
  getOneWeekAgo,
  getOneYearAgo,
  isValidDate,
} from "../../utils";

interface PipelinesMetricsProps {
  project: IProjectInfo;
  repo: GitRepository;
}

interface PipelinesMetricsState {
  stats: PipelineStats[];
  fromDate: Date;
}

interface PipelineStats {
  name: string;
  totalDurationInMinutes: number;
  totalBuilds: number;
  averageBuildTimeInMinutes: number;
}

export interface ITableItem extends ISimpleTableCell {
  name: string;
  totalDurationInMinutes: number;
  totalBuilds: number;
  averageBuildTimeInMinutes: number;
}

interface FilterValue extends IFilterState {
  searchTerm: {
    value: string;
  };
}

export class PipelinesMetrics extends React.Component<
  PipelinesMetricsProps,
  PipelinesMetricsState
> {
  private filter: Filter;
  private allTableItems: ITableItem[] = [];
  private filteredTableItems: ITableItem[] = [];
  private itemProvider = new ObservableValue<ArrayItemProvider<ITableItem>>(
    new ArrayItemProvider([])
  );
  private sortFunctions = [
    (item1: ITableItem, item2: ITableItem): number => {
      return item1.name.localeCompare(item2.name);
    },
    (item1: ITableItem, item2: ITableItem): number => {
      return item1.totalBuilds - item2.totalBuilds;
    },
    (item1: ITableItem, item2: ITableItem): number => {
      return item1.totalDurationInMinutes - item2.totalDurationInMinutes;
    },
    (item1: ITableItem, item2: ITableItem): number => {
      return item1.averageBuildTimeInMinutes - item2.averageBuildTimeInMinutes;
    },
  ];
  private sortingBehavior = this.updateSortingBehavior();
  constructor(props: PipelinesMetricsProps) {
    super(props);
    this.filter = new Filter();
    this.filter.subscribe(() => {
      this.applyFilter();
    }, FILTER_CHANGE_EVENT);
  }

  public componentDidMount() {
    try {
      SDK.init();

      SDK.ready()
        .then(() => {
          this.loadPipelineMetrics(getOneMonthAgo());
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

  applyFilter() {
    const filterValue = this.filter.getState() as FilterValue;
    if (filterValue?.searchTerm === undefined) {
      this.filteredTableItems = this.allTableItems;
    } else {
      this.filteredTableItems = this.allTableItems.filter((item) =>
        item.name
          .toLowerCase()
          .includes(filterValue.searchTerm.value.toLowerCase())
      );
    }

    this.itemProvider.value = new ArrayItemProvider(this.filteredTableItems);
    this.sortingBehavior = this.updateSortingBehavior();
  }

  updateSortingBehavior(): ColumnSorting<ITableItem> {
    return new ColumnSorting<ITableItem>(
      (columnIndex: number, proposedSortOrder: SortOrder) => {
        this.itemProvider.value = new ArrayItemProvider(
          sortItems(
            columnIndex,
            proposedSortOrder,
            this.sortFunctions,
            columns,
            this.filteredTableItems
          )
        );
      }
    );
  }

  public render(): JSX.Element {
    if (!this.state) {
      return <div></div>;
    }

    const { stats, fromDate } = this.state;

    this.allTableItems = stats as ITableItem[];

    this.filteredTableItems = this.allTableItems;

    this.itemProvider = new ObservableValue<ArrayItemProvider<ITableItem>>(
      new ArrayItemProvider(this.filteredTableItems)
    );

    const total = stats.reduce(
      (acc, stats) => {
        acc.totalDurationInMinutes += stats.totalDurationInMinutes;
        acc.totalBuilds += stats.totalBuilds;
        acc.averageBuildTimeInMinutes += stats.averageBuildTimeInMinutes;
        acc.count += 1;
        return acc;
      },
      {
        totalDurationInMinutes: 0,
        totalBuilds: 0,
        averageBuildTimeInMinutes: 0,
        count: 0,
      }
    );

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
                Pipeline Metrics
              </HeaderTitle>
            </HeaderTitleRow>
            <HeaderDescription>
              <Duration startDate={fromDate} />;
            </HeaderDescription>
          </HeaderTitleArea>
          <HeaderCommandBar items={this.commandBarItemsAdvanced} />
        </CustomHeader>
        <div className="bolt-page-content padding-16">
          <Card
            className="flex-grow"
            titleProps={{ text: "All Pipelines", ariaLevel: 3 }}
          >
            <div className="flex-row" style={{ flexWrap: "wrap" }}>
              <div className="flex-column" style={{ minWidth: "160px" }}>
                <div className="body-m secondary-text">Pipelines Count</div>
                <div className="body-m primary-text">{total.count}</div>
              </div>
              <div className="flex-column" style={{ minWidth: "160px" }}>
                <div className="body-m secondary-text">Total Runs</div>
                <div className="body-m primary-text">{total.totalBuilds}</div>
              </div>
              <div className="flex-column" style={{ minWidth: "160px" }}>
                <div className="body-m secondary-text">Total Duration</div>
                <div className="body-m primary-text">
                  {total.totalDurationInMinutes} minutes
                </div>
              </div>
              <div className="flex-column" style={{ minWidth: "160px" }}>
                <div className="body-m secondary-text">Average Duration</div>
                <div className="body-m primary-text">
                  {total.averageBuildTimeInMinutes} minutes
                </div>
              </div>
            </div>
          </Card>
        </div>
        <div className="bolt-page-content padding-16">
          <Card className="bolt-table-card">
            <div className="flex-grow">
              <div className="flex-grow">
                <FilterBar filter={this.filter}>
                  <KeywordFilterBarItem
                    filterItemKey="searchTerm"
                    placeholder="Filter by pipeline name"
                  />
                </FilterBar>
              </div>
              <div className="flex-grow">
                <Observer itemProvider={this.itemProvider}>
                  {(observableProps: {
                    itemProvider: ArrayItemProvider<ITableItem>;
                  }) => (
                    <Table<ITableItem>
                      ariaLabel="Pipelines Metrics"
                      columns={columns}
                      behaviors={[this.sortingBehavior]}
                      itemProvider={observableProps.itemProvider}
                      scrollable={true}
                      role="table"
                      pageSize={100}
                      containerClassName="h-scroll-auto"
                    />
                  )}
                </Observer>
              </div>
            </div>
          </Card>
        </div>
      </Page>
    );
  }

  private async loadPipelineMetrics(newFromDate: Date): Promise<void> {
    try {
      if (this.state !== null) {
        const { fromDate } = this.state;

        if (isValidDate(fromDate) && fromDate === newFromDate) {
          SDK.notifyLoadSucceeded();
          return;
        }
      }
      const { project, repo } = this.props;

      const builds = await getClient(BuildRestClient).getBuilds(
        project.id,
        undefined,
        undefined,
        undefined,
        newFromDate,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        repo.id,
        "TfsGit"
      );

      const map = new Map<string, { builds: Build[] }>();

      if (builds.length === 0) {
        this.setState({
          stats: [],
          fromDate: newFromDate,
        });
        return;
      }

      builds
        .filter((run) => run.finishTime !== undefined)
        .forEach((build) => {
          const key = build.definition.name;
          const currentValue = map.get(key);
          if (!currentValue) {
            map.set(key, { builds: [build] });
          } else {
            currentValue.builds.push(build);
          }
        });

      const stats: PipelineStats[] = [];
      map.forEach((value, key) => {
        const builds = value.builds;
        const totalBuilds = builds.length;
        const totalDuration = builds.reduce((acc, build) => {
          return acc + build.finishTime.getTime() - build.startTime.getTime();
        }, 0);

        const averageBuildTime = totalDuration / totalBuilds;

        const averageBuildTimeInMinutes = Math.floor(
          averageBuildTime / (1000 * 60)
        );

        const totalDurationInMinutes = Math.floor(totalDuration / (1000 * 60));

        stats.push({
          name: key,
          totalBuilds,
          totalDurationInMinutes,
          averageBuildTimeInMinutes,
        });
      });

      SDK.notifyLoadSucceeded();

      this.setState({
        stats,
        fromDate: newFromDate,
      });
    } catch (error) {
      console.error("Failed to load project context: ", error);
    }
  }

  private commandBarItemsAdvanced: IHeaderCommandBarItem[] = [
    {
      id: "1week",
      important: false,
      onActivate: () => {
        this.loadPipelineMetrics(getOneWeekAgo());
      },
      text: "1 week",
    },
    {
      id: "1month",
      important: false,
      onActivate: () => {
        this.loadPipelineMetrics(getOneMonthAgo());
      },
      text: "1 month",
    },
    {
      id: "1year",
      important: false,
      onActivate: () => {
        this.loadPipelineMetrics(getOneYearAgo());
      },
      text: "1 year",
    },
  ];
}

const columns: ITableColumn<ITableItem>[] = [
  {
    id: "name",
    name: "Name",
    renderCell: renderSimpleCell,
    sortProps: {
      ariaLabelAscending: "Sorted A to Z",
      ariaLabelDescending: "Sorted Z to A",
    },
    width: new ObservableValue(-30),
  },
  {
    id: "totalBuilds",
    name: "Total Builds",
    renderCell: renderSimpleCell,
    sortProps: {
      ariaLabelAscending: "Sorted low to high",
      ariaLabelDescending: "Sorted high to low",
    },
    width: new ObservableValue(-30),
  },
  {
    id: "totalDurationInMinutes",
    name: "Total Duration",
    renderCell: renderTotalDurationColumn,
    sortProps: {
      ariaLabelAscending: "Sorted low to high",
      ariaLabelDescending: "Sorted high to low",
    },
    width: new ObservableValue(-40),
  },
  {
    id: "averageBuildTimeInMinutes",
    name: "Avg Duration",
    renderCell: renderAvarageDurationColumn,
    sortProps: {
      ariaLabelAscending: "Sorted low to high",
      ariaLabelDescending: "Sorted high to low",
    },
    width: new ObservableValue(-40),
  },
];

function renderTotalDurationColumn(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ITableItem>,
  tableItem: ITableItem
): JSX.Element {
  return (
    <SimpleTableCell
      columnIndex={columnIndex}
      tableColumn={tableColumn}
      key={"col-" + columnIndex}
    >
      <div className="flex-row wrap-text">
        <span>{tableItem.totalDurationInMinutes} minutes</span>
      </div>
    </SimpleTableCell>
  );
}

function renderAvarageDurationColumn(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ITableItem>,
  tableItem: ITableItem
): JSX.Element {
  return (
    <SimpleTableCell
      columnIndex={columnIndex}
      tableColumn={tableColumn}
      key={"col-" + columnIndex}
    >
      <div className="flex-row wrap-text">
        <span>{tableItem.averageBuildTimeInMinutes} minutes</span>
      </div>
    </SimpleTableCell>
  );
}
