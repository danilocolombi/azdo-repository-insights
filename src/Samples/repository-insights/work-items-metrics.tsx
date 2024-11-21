import * as SDK from "azure-devops-extension-sdk";
import React from "react";

import {
  CommonServiceIds,
  getClient,
  IProjectInfo,
  IProjectPageService,
} from "azure-devops-extension-api";
import {
  GitPullRequestSearchCriteria,
  GitRepository,
  PullRequestStatus,
} from "azure-devops-extension-api/Git/Git";
import { Card } from "azure-devops-ui/Card";
import {
  ColumnSorting,
  ISimpleTableCell,
  ITableColumn,
  renderSimpleCell,
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
import { GitRestClient } from "azure-devops-extension-api/Git/GitClient";
import {
  WorkItem,
  WorkItemTrackingRestClient,
} from "azure-devops-extension-api/WorkItemTracking";
import {
  getOneMonthAgo,
  getOneWeekAgo,
  getOneYearAgo,
  isValidDate,
} from "../../utils";

interface WorkItemsMetricsProps {
  project: IProjectInfo;
  repo: GitRepository;
}

interface WorkItemsMetricsState {
  workItems: WorkItem[];
  fromDate: Date;
}

export interface ITableItem extends ISimpleTableCell {
  title: string;
  type: number;
  state: number;
}

interface FilterValue extends IFilterState {
  searchTerm: {
    value: string;
  };
}

export class WorkItemsMetrics extends React.Component<
  WorkItemsMetricsProps,
  WorkItemsMetricsState
> {
  private filter: Filter;
  private allTableItems: ITableItem[] = [];
  private filteredTableItems: ITableItem[] = [];
  private itemProvider = new ObservableValue<ArrayItemProvider<ITableItem>>(
    new ArrayItemProvider([])
  );
  private sortFunctions = [
    (item1: ITableItem, item2: ITableItem): number => {
      return item1.title.localeCompare(item2.title);
    },
    (item1: ITableItem, item2: ITableItem): number => {
      return item1.type - item2.type;
    },
    (item1: ITableItem, item2: ITableItem): number => {
      return item1.state - item2.state;
    },
  ];
  private sortingBehavior = this.updateSortingBehavior();
  constructor(props: WorkItemsMetricsProps) {
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
          this.loadWorkItemsMetrics(getOneMonthAgo());
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
        item.title
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

    const { workItems, fromDate } = this.state;

    this.allTableItems = workItems.map((workItem) => ({
      title: workItem.fields["System.Title"],
      type: workItem.fields["System.WorkItemType"],
      state: workItem.fields["System.State"],
    }));

    this.filteredTableItems = this.allTableItems;

    this.itemProvider = new ObservableValue<ArrayItemProvider<ITableItem>>(
      new ArrayItemProvider(this.filteredTableItems)
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
                Work Items Metrics
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
            className="bolt-table-card"
            titleProps={{ text: "Work items linked to closed PRs" }}
          >
            <div className="flex-grow">
              <div className="flex-grow">
                <FilterBar filter={this.filter}>
                  <KeywordFilterBarItem
                    filterItemKey="searchTerm"
                    placeholder="Filter by work item"
                  />
                </FilterBar>
              </div>
              <div className="flex-grow">
                <Observer itemProvider={this.itemProvider}>
                  {(observableProps: {
                    itemProvider: ArrayItemProvider<ITableItem>;
                  }) => (
                    <Table<ITableItem>
                      ariaLabel="Work items Metrics"
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

  private async loadWorkItemsMetrics(newFromDate: Date): Promise<void> {
    try {
      if (this.state !== null) {
        const { fromDate } = this.state;

        if (isValidDate(fromDate) && fromDate === newFromDate) {
          SDK.notifyLoadSucceeded();
          return;
        }
      }

      const { project, repo } = this.props;

      const searchCriteria = {
        status: PullRequestStatus.Completed,
        minTime: newFromDate,
        includeLinks: true,
        targetRefName: repo.defaultBranch,
      } as GitPullRequestSearchCriteria;

      const gitClient = getClient(GitRestClient);

      const prs = await gitClient.getPullRequests(repo.id, searchCriteria);

      if (prs.length === 0) {
        this.setState({
          workItems: [],
          fromDate: newFromDate,
        });
        return;
      }

      const workItemRefs = await Promise.all(
        prs.map(({ repository, pullRequestId }) =>
          gitClient.getPullRequestWorkItemRefs(repository.id, pullRequestId)
        )
      );

      const workItemIds = Array.from(
        new Set(
          workItemRefs.reduce((acc, workItems) => {
            return acc.concat(workItems.map((workItem) => Number(workItem.id)));
          }, [] as number[])
        )
      );

      if (workItemIds.length === 0) {
        this.setState({
          workItems: [],
          fromDate: newFromDate,
        });
        return;
      }

      const client = getClient(WorkItemTrackingRestClient);

      const workItems = await client.getWorkItems(workItemIds, project.name, [
        "System.Title",
        "System.WorkItemType",
        "System.State",
      ]);

      SDK.notifyLoadSucceeded();

      this.setState({
        workItems,
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
        this.loadWorkItemsMetrics(getOneWeekAgo());
      },
      text: "1 week",
    },
    {
      id: "1month",
      important: false,
      onActivate: () => {
        this.loadWorkItemsMetrics(getOneMonthAgo());
      },
      text: "1 month",
    },
    {
      id: "1year",
      important: false,
      onActivate: () => {
        this.loadWorkItemsMetrics(getOneYearAgo());
      },
      text: "1 year",
    },
  ];
}

const columns: ITableColumn<ITableItem>[] = [
  {
    id: "title",
    name: "Title",
    renderCell: renderSimpleCell,
    sortProps: {
      ariaLabelAscending: "Sorted A to Z",
      ariaLabelDescending: "Sorted Z to A",
    },
    width: new ObservableValue(-30),
  },
  {
    id: "type",
    name: "Type",
    renderCell: renderSimpleCell,
    sortProps: {
      ariaLabelAscending: "Sorted low to high",
      ariaLabelDescending: "Sorted high to low",
    },
    width: new ObservableValue(-30),
  },
  {
    id: "state",
    name: "State",
    renderCell: renderSimpleCell,
    sortProps: {
      ariaLabelAscending: "Sorted low to high",
      ariaLabelDescending: "Sorted high to low",
    },
    width: new ObservableValue(-40),
  },
];
