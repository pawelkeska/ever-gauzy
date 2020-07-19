import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { CandidateInterviewService } from 'apps/gauzy/src/app/@core/services/candidate-interview.service';
import { ICandidateInterview, Candidate, Employee } from '@gauzy/models';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { takeUntil, first } from 'rxjs/operators';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { CandidateInterviewMutationComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-interview-mutation/candidate-interview-mutation.component';
import { DeleteInterviewComponent } from 'apps/gauzy/src/app/@shared/candidate/candidate-confirmation/delete-interview/delete-interview.component';
@Component({
	selector: 'ga-interview-panel',
	templateUrl: './interview-panel.component.html',
	styleUrls: ['./interview-panel.component.scss']
})
export class InterviewPanelComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	interviewList: ICandidateInterview[];
	candidates: Candidate[];
	averageRating: number;
	employeeList: Employee[];
	allInterviews: ICandidateInterview[];
	interviewTitle: ICandidateInterview[];
	interviewSearch: FormControl = new FormControl();
	candidateSearch: FormControl = new FormControl();
	sort: FormControl = new FormControl();
	isResetSelect: boolean;
	filterParams = {
		name: '',
		title: '',
		employeeIds: null
	};
	loading: boolean;
	constructor(
		private dialogService: NbDialogService,
		readonly translateService: TranslateService,
		private toastrService: NbToastrService,
		private candidateInterviewService: CandidateInterviewService,
		private candidatesService: CandidatesService,
		private employeesService: EmployeesService,
		private router: Router
	) {
		super(translateService);
	}
	async ngOnInit() {
		this.loadInterviews();
		this.interviewSearch.valueChanges.subscribe((item) => {
			this.filterBySearch(item, 'title');
		});
		this.candidateSearch.valueChanges.subscribe((item) => {
			this.filterBySearch(item, 'name');
		});
	}
	filterBySearch(item: string, type: string) {
		type === 'name'
			? (this.filterParams.name = item)
			: (this.filterParams.title = item);
		this.isResetSelect = false;
		this.filterInterviews();
	}
	onEmployeeSelected(employeeIds: string[]) {
		this.filterParams.employeeIds = employeeIds;
		this.isResetSelect = false;
		this.filterInterviews();
	}
	filterInterviews() {
		//TO DO
		if (
			!this.filterParams.name &&
			!this.filterParams.title &&
			!this.filterParams.employeeIds
		)
			this.interviewList = this.allInterviews;

		if (
			this.filterParams.name &&
			!this.filterParams.title &&
			!this.filterParams.employeeIds
		)
			this.interviewList = this.allInterviews.filter(
				(interview) =>
					interview.candidate.user.name
						.toLocaleLowerCase()
						.indexOf(this.filterParams.name.toLocaleLowerCase()) !==
					-1
			);

		if (
			!this.filterParams.name &&
			this.filterParams.title &&
			!this.filterParams.employeeIds
		)
			this.interviewList = this.allInterviews.filter(
				(interview) =>
					interview.title
						.toLocaleLowerCase()
						.indexOf(
							this.filterParams.title.toLocaleLowerCase()
						) !== -1
			);
		if (
			!this.filterParams.name &&
			!this.filterParams.title &&
			this.filterParams.employeeIds
		) {
			if (!this.filterParams.employeeIds[0]) {
				this.interviewList = this.allInterviews;
			} else {
				const result = [];
				this.allInterviews.forEach((interview) => {
					interview.interviewers.forEach((interviewer) => {
						this.filterParams.employeeIds.forEach(
							(item: string) => {
								if (
									item === interviewer.employeeId &&
									!result.includes(interview)
								) {
									result.push(interview);
								}
							}
						);
					});
				});
				this.interviewList = result;
			}
		}
	}
	clearFilters() {
		this.candidateSearch.reset();
		this.interviewSearch.reset();
		// this.isResetSelect = true;
		this.filterParams.name = '';
		this.filterParams.title = '';
		this.filterParams.employeeIds = null;
		this.interviewList = this.allInterviews;
	}
	onSortSelected(value: string) {
		switch (value) {
			case 'date':
				this.interviewList.sort(function (a, b) {
					const dateA = new Date(a.startTime),
						dateB = new Date(b.startTime);
					return dateB > dateA ? -1 : dateB < dateA ? 1 : 0;
				});
				break;
			case 'name':
				this.interviewList.sort(function (a, b) {
					const nameA = a.candidate.user.name.toLowerCase(),
						nameB = b.candidate.user.name.toLowerCase();
					return nameB > nameA ? -1 : nameB < nameA ? 1 : 0;
				});
				break;
			case 'rating':
				this.interviewList.sort((a, b) => b.rating - a.rating);
				break;
			default:
				return this.interviewList;
		}
	}
	async loadInterviews() {
		this.loading = true;
		const interviews = await this.candidateInterviewService.getAll([
			'feedbacks',
			'interviewers',
			'technologies',
			'personalQualities',
			'candidate'
		]);
		if (interviews) {
			this.interviewList = interviews.items;
			this.allInterviews = interviews.items;
			this.candidatesService
				.getAll(['user'])
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((candidates) => {
					this.candidates = candidates.items;
					this.interviewList.forEach((interview) => {
						this.loadEmployee(interview);
						this.candidates.forEach((item) => {
							if (item.id === interview.candidateId) {
								interview.candidate = item;
							}
						});

						if (interview.feedbacks.length > 0) {
							const res: number[] = [];
							interview.feedbacks.forEach((fb) => {
								res.push(Number(fb.rating));
							});
							const fbSum = res.reduce((sum, current) => {
								return sum + current;
							});
							interview.rating =
								fbSum / interview.feedbacks.length;
						} else {
							interview.rating = 0;
						}
					});
					this.loading = false;
				});
		}
	}
	async loadEmployee(interview: ICandidateInterview) {
		const employees = [];
		const { items } = await this.employeesService
			.getAll(['user'])
			.pipe(first())
			.toPromise();
		this.employeeList = items;
		interview.interviewers.forEach((interviewer) => {
			this.employeeList.forEach((employee) => {
				if (interviewer.employeeId === employee.id) {
					employees.push(employee);
				}
			});
		});
		interview.employees = employees;
	}
	async editInterview(id: string) {
		const currentInterview = this.interviewList.find(
			(item) => item.id === id
		);
		const dialog = this.dialogService.open(
			CandidateInterviewMutationComponent,
			{
				context: {
					header: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.INTERVIEW.EDIT_INTERVIEW'
					),
					editData: currentInterview,
					selectedCandidate: currentInterview.candidate,
					interviewId: id,
					interviewList: this.interviewList
				}
			}
		);
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('UPDATED');
			this.loadInterviews();
		}
	}
	async removeInterview(id: string) {
		const currentInterview = this.interviewList.find(
			(item) => item.id === id
		);
		const dialog = this.dialogService.open(DeleteInterviewComponent, {
			context: {
				interview: currentInterview
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('DELETED');
			this.loadInterviews();
		}
	}
	isPastInterview(interview: ICandidateInterview) {
		const now = new Date().getTime();
		if (new Date(interview.startTime).getTime() > now) {
			return false;
		} else {
			return true;
		}
	}
	goToCandidate(id: string) {
		this.router.navigate([
			`/pages/employees/candidates/edit/${id}/profile/interview`
		]);
	}
	private toastrSuccess(text: string) {
		this.toastrService.success(
			this.getTranslation('TOASTR.TITLE.SUCCESS'),
			this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EDIT_${text}`)
		);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
